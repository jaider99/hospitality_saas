import logging
import json
import random
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.module.invoices.model import Supplier, SuppliedProduct, ProductCostHistory, Invoice, InvoiceLine, InvoiceTaxBracket
from app.module.recipes.model import Recipe, RecipeIngredient
from app.module.incidents.model import OperationalIncident
from app.core.config import PRICE_SPIKE_THRESHOLD, PRICE_SPIKE_HIGH_THRESHOLD
from app.core.translation import translate

logger = logging.getLogger("async_invoice_service")


async def async_save_ocr_invoice(
    db: AsyncSession,
    invoice_id: int,
    ocr_invoice,  # app.ocr.schema.OcrInvoice
    lang: str = "en",
) -> Dict[str, Any]:
    """
    Persist a fully extracted OcrInvoice DTO (from app.ocr.pipeline) into the
    hospitality-be database, wiring it to the existing Invoice/InvoiceLine/Supplier
    SQLModel tables.

    This replaces the Gemini-based flow with the full PaddleOCR pipeline result.
    """
    # --- Resolve / create Supplier ---
    supplier_name = (
        ocr_invoice.supplier.display_name
        or ocr_invoice.supplier.legal_name
        or "Unknown Supplier"
    )
    supplier_tax_id = ocr_invoice.supplier.tax_id

    # Try to find by tax_id first (most accurate), then by name
    supplier = None
    if supplier_tax_id:
        stmt = select(Supplier).where(Supplier.vat_id == supplier_tax_id)
        result = await db.execute(stmt)
        supplier = result.scalars().first()

    if not supplier:
        stmt = select(Supplier).where(Supplier.name.ilike(supplier_name))
        result = await db.execute(stmt)
        supplier = result.scalars().first()

    if not supplier:
        supplier = Supplier(
            name=supplier_name,
            vat_id=supplier_tax_id,
            legal_name=ocr_invoice.supplier.legal_name,
            address=ocr_invoice.supplier.address,
            contacts=ocr_invoice.supplier.contact_count or 0,
        )
        db.add(supplier)
        await db.commit()
        await db.refresh(supplier)
    else:
        # Update existing supplier with new info if available
        if supplier_tax_id and not supplier.vat_id:
            supplier.vat_id = supplier_tax_id
        if ocr_invoice.supplier.legal_name and not supplier.legal_name:
            supplier.legal_name = ocr_invoice.supplier.legal_name
        if ocr_invoice.supplier.address and not supplier.address:
            supplier.address = ocr_invoice.supplier.address
        db.add(supplier)
        await db.commit()
        await db.refresh(supplier)

    # --- Update the existing PENDING Invoice record ---
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise ValueError(f"Invoice {invoice_id} not found.")

    gi = ocr_invoice.general_info
    totals = ocr_invoice.totals
    status_info = ocr_invoice.status
    meta = ocr_invoice.meta

    # Parse document date
    issue_date = None
    if gi.date:
        try:
            from datetime import date
            issue_date = datetime.fromisoformat(gi.date)
        except Exception:
            issue_date = None

    # Map OCR fields onto the Invoice model
    invoice.invoice_number = gi.document_number
    invoice.supplier_id = supplier.id
    invoice.issue_date = issue_date
    invoice.total_amount = totals.total_with_iva or 0.0
    invoice.status = "PROCESSED"

    # OCR general info
    invoice.document_type = gi.document_type
    invoice.document_number = gi.document_number
    invoice.document_date = gi.date
    invoice.category = gi.category
    invoice.uploaded_by = gi.uploaded_by

    # OCR supplier info (denormalized)
    invoice.supplier_display_name = ocr_invoice.supplier.display_name
    invoice.supplier_legal_name = ocr_invoice.supplier.legal_name
    invoice.supplier_tax_id = supplier_tax_id
    invoice.supplier_address = ocr_invoice.supplier.address
    invoice.supplier_contact_count = ocr_invoice.supplier.contact_count

    # OCR totals
    invoice.base_amount = totals.base_amount
    invoice.iva_amount = totals.iva_amount
    invoice.discount = totals.discount
    invoice.paye = totals.paye
    invoice.green_point = totals.green_point
    invoice.ibee = totals.ibee
    invoice.attributable_cost = totals.attributable_cost
    invoice.tax_free_costs = totals.tax_free_costs
    invoice.total_with_iva = totals.total_with_iva

    # OCR status
    invoice.reconciliation_status = status_info.reconciliation_status
    invoice.payment_status = status_info.payment_status
    invoice.currency = ocr_invoice.currency

    # OCR meta
    invoice.source_file = meta.source_file
    invoice.language_detected = meta.language_detected
    invoice.extraction_method = meta.extraction_method
    invoice.ocr_confidence = meta.ocr_confidence
    invoice.needs_review = meta.needs_review
    invoice.review_reasons = json.dumps(meta.review_reasons) if meta.review_reasons else None
    invoice.raw_ocr_json = ocr_invoice.to_json()

    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)

    processed_lines = []

    # --- Process each line item ---
    for line in ocr_invoice.line_items:
        description = line.product or "Unknown Item"
        quantity = line.quantity or 0.0
        unit_price = line.gross_price or line.nominal_price or 0.0
        total_price = line.base or 0.0
        sku = line.provider_code

        # Find or create SuppliedProduct
        product_query = select(SuppliedProduct).where(
            SuppliedProduct.supplier_id == supplier.id
        )
        if sku:
            product_query = product_query.where(
                (SuppliedProduct.sku == sku) | (SuppliedProduct.name.ilike(description))
            )
        else:
            product_query = product_query.where(SuppliedProduct.name.ilike(description))

        result = await db.execute(product_query)
        product = result.scalars().first()

        price_increased = False
        increase_pct = 0.0
        old_price = 0.0

        if product:
            old_price = product.current_price
            if unit_price > old_price and unit_price > 0:
                price_increased = True
                increase_pct = ((unit_price - old_price) / old_price) * 100

                history = ProductCostHistory(product_id=product.id, price=old_price)
                db.add(history)

                product.current_price = unit_price
                product.updated_at = datetime.utcnow()
                db.add(product)
                await db.commit()
                await db.refresh(product)
        else:
            if not sku:
                sku = f"{supplier_name[:3].upper()}-{random.randint(1000, 9999)}"
            product = SuppliedProduct(
                name=description,
                sku=sku,
                supplier_id=supplier.id,
                current_price=unit_price,
                unit=line.unit or "units",
            )
            db.add(product)
            await db.commit()
            await db.refresh(product)

        # Create InvoiceLine with full OCR detail
        invoice_line = InvoiceLine(
            invoice_id=invoice.id,
            description=description,
            quantity=quantity,
            unit_price=unit_price,
            total_price=total_price,
            product_id=product.id,
            # OCR-specific fields
            provider_code=line.provider_code,
            product=line.product,
            unit=line.unit,
            gross_price=line.gross_price,
            discount_pct=line.discount_pct,
            applied_discount=line.applied_discount,
            other_fees=line.other_fees,
            nominal_price=line.nominal_price,
            iva_pct=line.iva_pct,
            base=line.base,
        )
        db.add(invoice_line)
        await db.commit()
        await db.refresh(invoice_line)

        processed_lines.append({
            "id": invoice_line.id,
            "invoice_id": invoice.id,
            "description": description,
            "quantity": quantity,
            "unit_price": unit_price,
            "total_price": total_price,
            "product_id": product.id,
            "sku": product.sku,
            "price_increased": price_increased,
            "increase_pct": increase_pct,
        })

        # --- Trigger incident if price spike ---
        if price_increased and increase_pct >= PRICE_SPIKE_THRESHOLD:
            severity = "HIGH" if increase_pct >= PRICE_SPIKE_HIGH_THRESHOLD else "MEDIUM"
            message = translate(
                "price_hike_msg",
                lang=lang,
                product_name=product.name,
                sku=product.sku,
                pct=increase_pct,
                old=old_price,
                new=unit_price,
                invoice_number=gi.document_number,
                supplier_name=supplier_name,
            )
            incident = OperationalIncident(
                type="PRICE_HIKE",
                severity=severity,
                message=message,
                status="OPEN",
            )
            db.add(incident)
            await db.commit()

            await async_recalculate_dependent_recipes(db, product.id, product.name, lang=lang)

    # --- Persist IVA tax brackets ---
    if ocr_invoice.totals.iva_breakdown:
        for row in ocr_invoice.totals.iva_breakdown:
            bracket = InvoiceTaxBracket(
                invoice_id=invoice.id,
                rate_pct=row.rate_pct,
                base=row.base,
                iva_amount=row.iva_amount,
                row_total=row.row_total,
            )
            db.add(bracket)
        await db.commit()

    return {
        "invoiceId": invoice.id,
        "invoiceNumber": gi.document_number,
        "supplierName": supplier_name,
        "totalAmount": totals.total_with_iva or 0.0,
        "linesCount": len(processed_lines),
        "lines": processed_lines,
        "needsReview": meta.needs_review,
        "extractionMethod": meta.extraction_method,
        "ocrConfidence": meta.ocr_confidence,
    }



async def async_process_invoice_upload(
    db: AsyncSession,
    invoice_id: int,
    file_bytes: bytes,
    mime_type: str,
    lang: str = "en"
) -> Dict[str, Any]:
    """
    Processes an uploaded invoice asynchronously inside the background worker.
    Parses via Gemini, links/creates Supplier, updates Invoice records,
    re-catalogs SuppliedProducts, computes price spikes, and logs incidents.
    """
    # Import AiService locally to avoid circular import loops
    from app.module.ai.service import ai_service

    # 1. Ask Gemini to extract structured invoice JSON (run in threadpool to avoid blocking event loop)
    logger.info(f"Submitting invoice file to Gemini parser for invoice ID: {invoice_id}")
    parsed_data = await asyncio.to_thread(ai_service.parse_invoice, file_bytes, mime_type)

    invoice_number = parsed_data.get("invoiceNumber")
    supplier_name = parsed_data.get("supplierName")
    issue_date_str = parsed_data.get("issueDate")
    total_amount = float(parsed_data.get("totalAmount", 0))
    lines = parsed_data.get("lines", [])

    # Parse issue date safely
    try:
        issue_date = datetime.fromisoformat(issue_date_str.replace("Z", "+00:00"))
        issue_date = issue_date.replace(tzinfo=None)
    except Exception:
        issue_date = datetime.utcnow()


    # 2. Find or create the Supplier
    statement = select(Supplier).where(Supplier.name.ilike(supplier_name))
    result = await db.execute(statement)
    supplier = result.scalars().first()

    if not supplier:
        supplier = Supplier(name=supplier_name)
        db.add(supplier)
        await db.commit()
        await db.refresh(supplier)

    # 3. Retrieve and Update the pending Invoice record
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise ValueError(f"Invoice with ID {invoice_id} not found in database.")

    invoice.invoice_number = invoice_number
    invoice.supplier_id = supplier.id
    invoice.issue_date = issue_date
    invoice.total_amount = total_amount
    invoice.status = "PROCESSED"
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)

    processed_lines = []

    # 4. Process each line item
    for line in lines:
        description = line.get("description")
        quantity = float(line.get("quantity", 0))
        unit_price = float(line.get("unitPrice", 0))
        total_price = float(line.get("totalPrice", 0))
        sku = line.get("sku")
        unit = line.get("unit", "units")

        # Search for pre-existing product under this supplier
        product_query = select(SuppliedProduct).where(
            SuppliedProduct.supplier_id == supplier.id
        )
        if sku:
            product_query = product_query.where(
                (SuppliedProduct.sku == sku) | (SuppliedProduct.name.ilike(description))
            )
        else:
            product_query = product_query.where(SuppliedProduct.name.ilike(description))

        result = await db.execute(product_query)
        product = result.scalars().first()

        price_increased = False
        increase_pct = 0.0

        if product:
            old_price = product.current_price
            if unit_price > old_price:
                price_increased = True
                # Percentage increase calculation
                increase_pct = ((unit_price - old_price) / old_price) * 100

                # Log cost history
                history = ProductCostHistory(
                    product_id=product.id,
                    price=old_price
                )
                db.add(history)

                # Update current price
                product.current_price = unit_price
                product.updated_at = datetime.utcnow()
                db.add(product)
                await db.commit()
                await db.refresh(product)
        else:
            # Create a new SuppliedProduct
            if not sku:
                sku = f"{supplier_name[:3].upper()}-{random.randint(1000, 9999)}"
            product = SuppliedProduct(
                name=description,
                sku=sku,
                supplier_id=supplier.id,
                current_price=unit_price,
                unit=unit
            )
            db.add(product)
            await db.commit()
            await db.refresh(product)

        # Create InvoiceLine
        invoice_line = InvoiceLine(
            invoice_id=invoice.id,
            description=description,
            quantity=quantity,
            unit_price=unit_price,
            total_price=total_price,
            product_id=product.id
        )
        db.add(invoice_line)
        await db.commit()
        await db.refresh(invoice_line)

        processed_lines.append({
            "id": invoice_line.id,
            "invoice_id": invoice.id,
            "description": description,
            "quantity": quantity,
            "unit_price": unit_price,
            "total_price": total_price,
            "product_id": product.id,
            "sku": product.sku,
            "price_increased": price_increased,
            "increase_pct": increase_pct
        })

        # 5. Trigger Incident if price spike exceeds threshold
        if price_increased and increase_pct >= PRICE_SPIKE_THRESHOLD:
            severity = "HIGH" if increase_pct >= PRICE_SPIKE_HIGH_THRESHOLD else "MEDIUM"

            # Format bilingual message
            message = translate(
                "price_hike_msg",
                lang=lang,
                product_name=product.name,
                sku=product.sku,
                pct=increase_pct,
                old=old_price,
                new=unit_price,
                invoice_number=invoice_number,
                supplier_name=supplier_name
            )

            incident = OperationalIncident(
                type="PRICE_HIKE",
                severity=severity,
                message=message,
                status="OPEN"
            )
            db.add(incident)
            await db.commit()

            # Recalculate dependent recipes margins
            await async_recalculate_dependent_recipes(db, product.id, product.name, lang=lang)

    return {
        "invoiceId": invoice.id,
        "invoiceNumber": invoice_number,
        "supplierName": supplier_name,
        "totalAmount": total_amount,
        "linesCount": len(lines),
        "lines": processed_lines
    }

async def async_recalculate_dependent_recipes(db: AsyncSession, product_id: int, product_name: str, lang: str = "en") -> None:
    """
    Recalculates all recipes containing the changed product.
    Logs margin alert incident if actual portion cost exceeds target boundaries.
    """
    # Find ingredients linking to this product
    ri_statement = select(RecipeIngredient).where(RecipeIngredient.product_id == product_id)
    result = await db.execute(ri_statement)
    ingredients = result.scalars().all()

    for ing in ingredients:
        recipe = await db.get(Recipe, ing.recipe_id)
        if not recipe:
            continue

        # Calculate total recipe portion cost
        # Query ingredients explicitly to avoid lazy loading MissingGreenlet issues
        ing_statement = select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id)
        recipe_ingredients = (await db.execute(ing_statement)).scalars().all()

        total_cost = 0.0
        for ingredient in recipe_ingredients:
            # Get latest ingredient product price
            prod = await db.get(SuppliedProduct, ingredient.product_id)
            if prod:
                total_cost += prod.current_price * ingredient.quantity

        # Margin Check: actual cost percentage: (totalCost / salePrice) * 100
        sale_price = recipe.sale_price
        if sale_price > 0.0:
            actual_cost_pct = (total_cost / sale_price) * 100
            target_cost_pct = recipe.target_cost_percentage

            if actual_cost_pct > target_cost_pct:
                message = translate(
                    "recipe_margin_msg",
                    lang=lang,
                    recipe_name=recipe.name,
                    cost=total_cost,
                    actual=actual_cost_pct,
                    target=target_cost_pct,
                    product_name=product_name
                )

                incident = OperationalIncident(
                    type="PRICE_HIKE",
                    severity="HIGH",
                    message=message,
                    status="OPEN"
                )
                db.add(incident)
                await db.commit()
