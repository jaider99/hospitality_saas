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
        ocr_invoice.supplier.name if ocr_invoice.supplier else None
    )
    # Only fallback to "Unknown Supplier" for database queries, but preserve actual name if available
    supplier_tax_id = ocr_invoice.supplier.vatID if ocr_invoice.supplier else None
    supplier_address = ocr_invoice.supplier.address if ocr_invoice.supplier else None
    supplier_contact_info = ocr_invoice.supplier.contactInfo if ocr_invoice.supplier else None
    supplier_legal_name = ocr_invoice.supplier.legalName if ocr_invoice.supplier else None
    supplier_contacts_count = ocr_invoice.supplier.contacts if ocr_invoice.supplier else 0

    # Try to find by tax_id first (most accurate), then by name
    supplier = None
    if supplier_tax_id:
        stmt = select(Supplier).where(Supplier.vat_id == supplier_tax_id)
        result = await db.execute(stmt)
        supplier = result.scalars().first()

    if not supplier and supplier_name:
        # Only do ilike lookup when we have a real name
        stmt = select(Supplier).where(Supplier.name.ilike(supplier_name))
        result = await db.execute(stmt)
        supplier = result.scalars().first()

    if not supplier:
        supplier = Supplier(
            name=supplier_name or "Unknown Supplier",  # Only default to "Unknown" if creating new
            vat_id=supplier_tax_id,
            address=supplier_address,
            contact_info=supplier_contact_info,
            legal_name=supplier_legal_name,
            contacts=supplier_contacts_count or 0,
        )
        db.add(supplier)
        await db.commit()
        await db.refresh(supplier)
    else:
        # Update existing supplier with new info if available
        if supplier_tax_id and not supplier.vat_id:
            supplier.vat_id = supplier_tax_id
        if supplier_address and not supplier.address:
            supplier.address = supplier_address
        if supplier_contact_info and not supplier.contact_info:
            supplier.contact_info = supplier_contact_info
        if supplier_legal_name and not supplier.legal_name:
            supplier.legal_name = supplier_legal_name
        if supplier_contacts_count and supplier.contacts < supplier_contacts_count:
            supplier.contacts = supplier_contacts_count
        db.add(supplier)
        await db.commit()
        await db.refresh(supplier)

    current_supplier_id = supplier.id

    # --- Update the existing PENDING Invoice record ---
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise ValueError(f"Invoice {invoice_id} not found.")

    # Parse document date
    issue_date = None
    if getattr(ocr_invoice, 'date', None):
        try:
            from datetime import date
            issue_date = datetime.fromisoformat(ocr_invoice.date)
        except Exception:
            issue_date = None

    # Map OCR fields onto the Invoice model
    invoice.invoice_number = ocr_invoice.serialNumber
    invoice.supplier_id = current_supplier_id
    invoice.issue_date = issue_date
    invoice.total_amount = ocr_invoice.total or 0.0
    invoice.status = "PROCESSED"

    # OCR general info
    invoice.document_type = ocr_invoice.type
    invoice.document_number = ocr_invoice.serialNumber
    invoice.document_date = ocr_invoice.date

    # OCR supplier info (denormalized)
    invoice.supplier_display_name = supplier_name
    invoice.supplier_tax_id = supplier_tax_id
    invoice.supplier_address = supplier_address
    invoice.supplier_contact_count = supplier_contacts_count
    invoice.supplier_contact_info = supplier_contact_info
    invoice.supplier_legal_name = supplier_legal_name

    # OCR totals
    invoice.base_amount = getattr(ocr_invoice, 'subtotal', 0.0)
    invoice.iva_amount = getattr(ocr_invoice, 'tax', 0.0)
    invoice.discount = getattr(ocr_invoice, 'discount', 0.0)
    invoice.paye = getattr(ocr_invoice, 'payeAmount', 0.0)
    invoice.green_point = getattr(ocr_invoice, 'greenPointAmount', 0.0)
    invoice.ibee = getattr(ocr_invoice, 'ibeeAmount', 0.0)
    invoice.attributable_cost = getattr(ocr_invoice, 'taxableAdditionalCost', 0.0)
    invoice.tax_free_costs = getattr(ocr_invoice, 'netAdditionalCost', 0.0)
    invoice.total_with_iva = getattr(ocr_invoice, 'total', 0.0)

    # OCR meta
    invoice.ocr_confidence = getattr(ocr_invoice, 'ocr_confidence', None)
    invoice.ocr_duration = getattr(ocr_invoice, 'ocr_duration', None)
    invoice.llm_duration = getattr(ocr_invoice, 'llm_duration', None)
    invoice.needs_review = getattr(ocr_invoice, 'needs_review', False)
    invoice.review_reasons = json.dumps(getattr(ocr_invoice, 'review_reasons', [])) if getattr(ocr_invoice, 'review_reasons', []) else None
    invoice.raw_ocr_json = ocr_invoice.to_json()

    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    
    current_invoice_id = invoice.id
    current_invoice_number = invoice.invoice_number
    current_total_amount = invoice.total_amount
    current_needs_review = invoice.needs_review

    # Clean up old lines and tax brackets before adding new ones (in case of re-processing)
    from sqlalchemy import delete
    await db.execute(delete(InvoiceLine).where(InvoiceLine.invoice_id == current_invoice_id))
    await db.execute(delete(InvoiceTaxBracket).where(InvoiceTaxBracket.invoice_id == current_invoice_id))
    await db.commit()


    processed_lines = []

    # --- Process each line item ---
    for line in getattr(ocr_invoice, 'items', []):
        description = getattr(line, 'product', "Unknown Item")
        quantity = getattr(line, 'quantity', 0.0)
        gp = getattr(line, 'grossPrice', None)
        np = getattr(line, 'nominalPrice', None)
        unit_price = gp if gp is not None else (np if np is not None else 0.0)
        total_price = getattr(line, 'base', 0.0)
        sku = getattr(line, 'providerCode', None)

        # Find or create SuppliedProduct
        product_query = select(SuppliedProduct).where(
            SuppliedProduct.supplier_id == current_supplier_id
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
            if old_price is not None and unit_price is not None and old_price > 0 and unit_price > old_price:
                price_increased = True
                increase_pct = ((unit_price - old_price) / old_price) * 100

                history = ProductCostHistory(product_id=product.id, price=old_price)
                db.add(history)

                product.current_price = unit_price
                product.updated_at = datetime.utcnow()
                db.add(product)
                await db.commit()
                await db.refresh(product)
            elif old_price is None and unit_price is not None:
                product.current_price = unit_price
                product.updated_at = datetime.utcnow()
                db.add(product)
                await db.commit()
                await db.refresh(product)
        else:
            if not sku:
                sku = f"{supplier_name[:3].upper()}-{random.randint(1000, 9999)}"
            else:
                # Check if SKU is globally taken by another supplier
                conflict_query = select(SuppliedProduct).where(SuppliedProduct.sku == sku)
                conflict_res = await db.execute(conflict_query)
                conflict_prod = conflict_res.scalars().first()
                if conflict_prod and conflict_prod.supplier_id != current_supplier_id:
                    # Append supplier ID to make it globally unique
                    sku = f"{sku}-{current_supplier_id}"

            product = SuppliedProduct(
                name=description,
                sku=sku,
                supplier_id=current_supplier_id,
                current_price=unit_price,
                unit=getattr(line, 'unit', "units") or "units",
            )
            db.add(product)
            try:
                await db.commit()
                await db.refresh(product)
            except Exception as e:
                import sqlalchemy.exc
                if isinstance(e, sqlalchemy.exc.IntegrityError):
                    await db.rollback()
                    result = await db.execute(select(SuppliedProduct).where(SuppliedProduct.sku == sku))
                    product = result.scalars().first()
                else:
                    raise e

        # Create InvoiceLine with full OCR detail
        invoice_line = InvoiceLine(
            invoice_id=current_invoice_id,
            description=description,
            quantity=quantity,
            unit_price=unit_price,
            total_price=total_price,
            product_id=product.id,
            # OCR-specific fields
            provider_code=sku,
            product=description,
            unit=getattr(line, 'unit', None),
            gross_price=getattr(line, 'grossPrice', None),
            discount_pct=getattr(line, 'discountPct', None),
            applied_discount=getattr(line, 'appliedDiscount', None),
            other_fees=getattr(line, 'otherFees', None),
            nominal_price=getattr(line, 'nominalPrice', None),
            iva_pct=getattr(line, 'iva_pct', None),
            base=total_price,
            gra=getattr(line, 'gra', None),
            u_m=getattr(line, 'u_m', None),
        )
        db.add(invoice_line)
        
        current_product_id = product.id
        current_product_sku = product.sku
        current_product_name = product.name
        
        await db.commit()
        await db.refresh(invoice_line)

        processed_lines.append({
            "id": invoice_line.id,
            "invoice_id": current_invoice_id,
            "description": description,
            "quantity": quantity,
            "unit_price": unit_price,
            "total_price": total_price,
            "product_id": current_product_id,
            "sku": current_product_sku,
            "price_increased": price_increased,
            "increase_pct": increase_pct,
        })

        # --- Trigger incident if price spike ---
        if price_increased and increase_pct >= PRICE_SPIKE_THRESHOLD:
            severity = "HIGH" if increase_pct >= PRICE_SPIKE_HIGH_THRESHOLD else "MEDIUM"
            message = translate(
                "price_hike_msg",
                lang=lang,
                product_name=current_product_name,
                sku=current_product_sku,
                pct=increase_pct,
                old=old_price,
                new=unit_price,
                invoice_number=current_invoice_number,
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

            await async_recalculate_dependent_recipes(db, current_product_id, current_product_name, lang=lang)

    # --- Persist IVA tax brackets ---
    for row in getattr(ocr_invoice, 'taxBrackets', []):
        bracket = InvoiceTaxBracket(
            invoice_id=current_invoice_id,
            rate_pct=getattr(row, 'taxRate', getattr(row, 'rate_pct', 0.0)),
            base=getattr(row, 'subtotal', getattr(row, 'base', 0.0)),
            iva_amount=getattr(row, 'tax', getattr(row, 'iva_amount', 0.0)),
            row_total=getattr(row, 'total', getattr(row, 'row_total', 0.0)),
        )
        db.add(bracket)
    await db.commit()

    return {
        "invoiceId": current_invoice_id,
        "invoiceNumber": current_invoice_number,
        "supplierName": supplier_name,
        "totalAmount": current_total_amount,
        "linesCount": len(processed_lines),
        "lines": processed_lines,
        "needsReview": current_needs_review,
        "extractionMethod": "ocr",
        "ocrConfidence": getattr(ocr_invoice, 'ocr_confidence', 0.0),
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

    current_supplier_id = supplier.id

    # 3. Retrieve and Update the pending Invoice record
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise ValueError(f"Invoice with ID {invoice_id} not found in database.")

    invoice.invoice_number = invoice_number
    invoice.supplier_id = current_supplier_id
    invoice.issue_date = issue_date
    invoice.total_amount = total_amount
    invoice.status = "PROCESSED"
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)

    current_invoice_id = invoice.id
    current_invoice_number = invoice.invoice_number
    current_total_amount = invoice.total_amount

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
            SuppliedProduct.supplier_id == current_supplier_id
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
                supplier_id=current_supplier_id,
                current_price=unit_price,
                unit=unit
            )
            db.add(product)
            try:
                await db.commit()
                await db.refresh(product)
            except Exception as e:
                import sqlalchemy.exc
                if isinstance(e, sqlalchemy.exc.IntegrityError):
                    await db.rollback()
                    result = await db.execute(select(SuppliedProduct).where(SuppliedProduct.sku == sku))
                    product = result.scalars().first()
                else:
                    raise e

        # Create InvoiceLine
        invoice_line = InvoiceLine(
            invoice_id=current_invoice_id,
            description=description,
            quantity=quantity,
            unit_price=unit_price,
            total_price=total_price,
            product_id=product.id
        )
        db.add(invoice_line)

        current_product_id = product.id
        current_product_sku = product.sku
        current_product_name = product.name

        await db.commit()
        await db.refresh(invoice_line)

        processed_lines.append({
            "id": invoice_line.id,
            "invoice_id": current_invoice_id,
            "description": description,
            "quantity": quantity,
            "unit_price": unit_price,
            "total_price": total_price,
            "product_id": current_product_id,
            "sku": current_product_sku,
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
                product_name=current_product_name,
                sku=current_product_sku,
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
            await async_recalculate_dependent_recipes(db, current_product_id, current_product_name, lang=lang)

    return {
        "invoiceId": current_invoice_id,
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
