from sqlmodel import Session, select
from fastapi import HTTPException, status
from datetime import datetime
import random
from typing import List, Dict, Any

from app.module.invoices.model import Supplier, SuppliedProduct, ProductCostHistory, Invoice, InvoiceLine
from app.module.recipes.model import Recipe, RecipeIngredient
from app.module.incidents.model import OperationalIncident
from app.core.config import PRICE_SPIKE_THRESHOLD, PRICE_SPIKE_HIGH_THRESHOLD
from app.core.translation import translate

def get_invoices(db: Session) -> List[Invoice]:
    """Retrieves all invoices ordered by issue date descending."""
    statement = select(Invoice).order_by(Invoice.issue_date.desc())
    return db.exec(statement).all()

def get_invoice_details(db: Session, invoice_id: int) -> Invoice:
    """Retrieves detailed invoice object or raises 404."""
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return invoice

def process_invoice_upload(
    db: Session, 
    file_bytes: bytes, 
    mime_type: str,
    lang: str = "en"
) -> Dict[str, Any]:
    """
    Processes an uploaded invoice: parses via Gemini, creates Supplier & Invoice records,
    re-catalogs SuppliedProducts, computes price spikes, and logs incidents if thresholds are breached.
    """
    # Import AiService locally to avoid circular import loops
    from app.module.ai.service import ai_service
    
    # 1. Ask Gemini to extract structured invoice JSON
    parsed_data = ai_service.parse_invoice(file_bytes, mime_type)
    
    invoice_number = parsed_data.get("invoiceNumber")
    supplier_name = parsed_data.get("supplierName")
    issue_date_str = parsed_data.get("issueDate")
    total_amount = float(parsed_data.get("totalAmount", 0))
    lines = parsed_data.get("lines", [])
    
    # Parse issue date safely
    try:
        issue_date = datetime.fromisoformat(issue_date_str.replace("Z", "+00:00"))
    except Exception:
        issue_date = datetime.utcnow()
        
    # 2. Find or create the Supplier
    statement = select(Supplier).where(Supplier.name.ilike(supplier_name))
    supplier = db.exec(statement).first()
    
    if not supplier:
        supplier = Supplier(name=supplier_name)
        db.add(supplier)
        db.commit()
        db.refresh(supplier)
        
    # 3. Create the Invoice record
    invoice = Invoice(
        invoice_number=invoice_number,
        supplier_id=supplier.id,
        issue_date=issue_date,
        total_amount=total_amount,
        status="PROCESSED"
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    
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
            
        product = db.exec(product_query).first()
        
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
                db.commit()
                db.refresh(product)
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
            db.commit()
            db.refresh(product)
            
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
        db.commit()
        db.refresh(invoice_line)
        
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
            db.commit()
            
            # Recalculate dependent recipes margins
            recalculate_dependent_recipes(db, product.id, product.name, lang=lang)
            
    return {
        "invoiceId": invoice.id,
        "invoiceNumber": invoice_number,
        "supplierName": supplier_name,
        "totalAmount": total_amount,
        "linesCount": len(lines),
        "lines": processed_lines
    }

def recalculate_dependent_recipes(db: Session, product_id: int, product_name: str, lang: str = "en") -> None:
    """
    Recalculates all recipes containing the changed product.
    Logs margin alert incident if actual portion cost exceeds target boundaries.
    """
    # Find ingredients linking to this product
    ri_statement = select(RecipeIngredient).where(RecipeIngredient.product_id == product_id)
    ingredients = db.exec(ri_statement).all()
    
    for ing in ingredients:
        recipe = ing.recipe
        if not recipe:
            continue
            
        # Calculate total recipe portion cost
        total_cost = 0.0
        for ingredient in recipe.ingredients:
            # Get latest ingredient product price
            prod = ingredient.product
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
                db.commit()
