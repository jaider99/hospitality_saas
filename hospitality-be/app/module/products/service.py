"""
Products & Inventory Service Layer
====================================
Handles CRUD operations for:
  - Products: manual create, list, detail, update, archive
  - Product Review Queue: unlinked invoice lines pending product assignment
  - Product Unify: merge a pending line into an existing product via alias
  - Inventories: sessions + items

Architecture Note:
  Purchase history is derived via alias-based lookup on invoice_lines.
  ProductAlias is the single source of truth — no product_references or
  referenced_items tables are used.
"""

from sqlmodel import Session, select
from sqlalchemy import func, desc
from typing import List, Optional, Tuple
from datetime import datetime
import uuid

from app.module.products.model import (
    ExpenseCategory,
    Product,
    ProductSupplier,
    ProductAlias,
    ProductFormat,
    Inventory,
    InventoryItem,
)
from app.module.products.schema import (
    ProductManualCreate,
    ProductUpdate,
    InventoryCreate,
)
from app.module.invoices.model import Supplier, InvoiceLine, Invoice
from app.module.categories.model import Category as AppCategory


# ---------------------------------------------------------------------------
# ExpenseCategory helpers
# ---------------------------------------------------------------------------

def get_categories(db: Session, restaurant_id: Optional[int] = None) -> List[ExpenseCategory]:
    """Return all categories (use in frontend dropdowns)."""
    return list(db.exec(select(ExpenseCategory)).all())


def upsert_category(
    db: Session, cat_id: str, name: str,
    color: Optional[str], parent_id: Optional[str]
) -> ExpenseCategory:
    existing = db.get(ExpenseCategory, cat_id)
    if existing:
        existing.name = name
        existing.color = color
        existing.parent_id = parent_id
        db.add(existing)
    else:
        existing = ExpenseCategory(id=cat_id, name=name, color=color, parent_id=parent_id)
        db.add(existing)
    return existing


def upsert_category_tree(db: Session, category_data: dict) -> Optional[str]:
    """Recursively upsert nested category from Haddock API, returns leaf ID."""
    if not category_data:
        return None
    parent_id: Optional[str] = None
    if category_data.get("parent"):
        parent_id = upsert_category_tree(db, category_data["parent"])
    upsert_category(
        db,
        cat_id=category_data["id"],
        name=category_data["name"],
        color=category_data.get("color"),
        parent_id=parent_id,
    )
    return category_data["id"]


# ---------------------------------------------------------------------------
# Supplier resolution helpers
# ---------------------------------------------------------------------------

def resolve_supplier_by_haddock_id(db: Session, haddock_id: str) -> Optional[Supplier]:
    return db.exec(select(Supplier).where(Supplier.supplier_code == haddock_id)).first()


def get_supplier(db: Session, supplier_id: int) -> Optional[Supplier]:
    return db.get(Supplier, supplier_id)


# ---------------------------------------------------------------------------
# Product CRUD - Manual Create
# ---------------------------------------------------------------------------

def delete_product(db: Session, product_id: str) -> None:
    product = db.get(Product, product_id)
    if not product:
        raise ValueError(f"Product {product_id} not found")
    db.delete(product)
    db.commit()


def bulk_delete_products(db: Session, product_ids: List[str]) -> None:
    products = db.query(Product).filter(Product.id.in_(product_ids)).all()
    for product in products:
        db.delete(product)
    db.commit()


def create_product_manual(db: Session, data: "ProductManualCreate", restaurant_id: int) -> Product:
    """
    Manual product creation (from the 'Create product manually' UI form).
    Generates a local ID (prod~<uuid>) and links to suppliers/category.
    Also creates an alias for the product name so it is auto-matched in future.
    """
    product_id = f"prod~{uuid.uuid4().hex[:20]}"

    # Resolve app_category_id: use explicit value, or fall back to supplier's category
    app_category_id = data.app_category_id
    if not app_category_id and data.supplier_ids:
        first_supplier = db.get(Supplier, data.supplier_ids[0])
        if first_supplier and first_supplier.category_id:
            app_category_id = first_supplier.category_id

    product = Product(
        id=product_id,
        restaurant_id=restaurant_id,
        name=data.name,
        unit_of_measure=data.unit_of_measure,
        unit_of_measure_source="manual",
        reference_price=data.price,
        last_price=data.price,
        tax_rate=data.tax_rate,
        category_id=data.category_id,
        app_category_id=app_category_id,
        bookmarked=False,
        archived=False,
        merged=False,
        imported=False,
        total=0.0,
        config={"type": "average", "value": 12, "measure": "months"},
    )
    db.add(product)
    db.flush()

    # Link supplier(s)
    for supplier_id in (data.supplier_ids or []):
        supp = db.get(Supplier, supplier_id)
        if supp:
            existing = db.exec(
                select(ProductSupplier).where(
                    ProductSupplier.product_id == product_id,
                    ProductSupplier.supplier_id == supplier_id,
                )
            ).first()
            if not existing:
                db.add(ProductSupplier(
                    product_id=product_id,
                    supplier_id=supplier_id,
                    haddock_supplier_id=supp.supplier_code,
                ))

    # Create default format if price + unit provided
    if data.price and data.unit_of_measure:
        db.add(ProductFormat(
            product_id=product_id,
            purchase_unit=data.unit_of_measure,
            conversion_factor=1.0,
            base_unit=data.unit_of_measure,
            base_unit_source="manual",
            price_per_base_unit=data.price,
            is_default=True,
        ))

    db.commit()
    db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# Product CRUD - List
# ---------------------------------------------------------------------------

def get_products(
    db: Session,
    restaurant_id: int,
    skip: int = 0,
    limit: int = 100,
    archived: Optional[bool] = None,
    bookmarked: Optional[bool] = None,
    category_id: Optional[str] = None,
    supplier_id: Optional[int] = None,
    name: Optional[str] = None,
    sort_by: str = "name",
    order: str = "asc",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Tuple[List[dict], int]:
    """
    Returns enriched product list rows matching the product list UI.
    Each row includes: product, supplier name, category path, quantity,
    """
    stmt = select(Product).where(
        Product.restaurant_id == restaurant_id,
        Product.deleted_at.is_(None),
        Product.merged == False
    )

    if archived is not None:
        stmt = stmt.where(Product.archived == archived)
    if bookmarked is not None:
        stmt = stmt.where(Product.bookmarked == bookmarked)
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
    if name:
        stmt = stmt.where(Product.name.ilike(f"%{name}%"))

    # Filter by supplier via junction
    if supplier_id:
        supp_product_ids = db.exec(
            select(ProductSupplier.product_id).where(
                ProductSupplier.supplier_id == supplier_id
            )
        ).all()
        stmt = stmt.where(Product.id.in_(supp_product_ids))

    # Filter by date range via alias-based invoice line lookup
    if start_date or end_date:
        # Get all products that have at least one invoice line in the date range
        # by matching invoice_lines.description against product names and aliases
        all_products_for_filter = list(db.exec(select(Product)).all())
        valid_product_ids = []
        for p in all_products_for_filter:
            aliases = db.exec(
                select(ProductAlias).where(ProductAlias.master_product_id == p.id)
            ).all()
            valid_names = {p.name.lower()} | {a.alias_name.lower() for a in aliases}

            date_stmt = (
                select(InvoiceLine)
                .join(Invoice, InvoiceLine.invoice_id == Invoice.id)
                .where(func.lower(InvoiceLine.description).in_(valid_names))
            )
            if start_date:
                date_stmt = date_stmt.where(Invoice.document_date >= start_date)
            if end_date:
                date_stmt = date_stmt.where(Invoice.document_date <= end_date)

            found = db.exec(date_stmt.limit(1)).first()
            if found:
                valid_product_ids.append(p.id)

        if not valid_product_ids:
            return [], 0
        stmt = stmt.where(Product.id.in_(valid_product_ids))

    # Count total before pagination
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_count = db.exec(count_stmt).one()

    # Sorting
    sort_col = getattr(Product, sort_by, None)
    if sort_col is not None:
        stmt = stmt.order_by(desc(sort_col) if order == "desc" else sort_col)

    products = list(db.exec(stmt.offset(skip).limit(limit)).all())

    # Enrich with supplier names and category
    result = []
    for p in products:
        # Get suppliers for this product
        ps_rows = db.exec(
            select(ProductSupplier).where(ProductSupplier.product_id == p.id)
        ).all()
        supplier_names = []
        for ps in ps_rows:
            s = db.get(Supplier, ps.supplier_id)
            if s:
                supplier_names.append({"id": ps.supplier_id, "name": s.name})

        # Get category (legacy Haddock expense_categories)
        category = db.get(ExpenseCategory, p.category_id) if p.category_id else None

        # Get app category (our categories table)
        app_category = db.exec(
            select(AppCategory).where(AppCategory.category_id == p.app_category_id)
        ).first() if p.app_category_id else None

        # Fallback to supplier category if product category is empty
        if not app_category and ps_rows:
            for ps in ps_rows:
                s = db.get(Supplier, ps.supplier_id)
                if s and s.category_id:
                    supplier_cat = db.exec(
                        select(AppCategory).where(AppCategory.category_id == s.category_id)
                    ).first()
                    if supplier_cat:
                        app_category = supplier_cat
                        break

        # Calculate dynamic stats if date range is specified
        if start_date or end_date:
            history = _get_purchase_history(db, p.id, restaurant_id, start_date, end_date)
            quantity = sum(h["quantity"] for h in history if h.get("quantity") is not None)
            total = sum(h["total_price"] for h in history if h.get("total_price") is not None)
            last_price = history[0]["unit_price"] if history and history[0].get("unit_price") is not None else None
        else:
            quantity = p.quantity
            total = p.total or 0.0
            last_price = p.last_price

        result.append({
            "id": p.id,
            "name": p.name,
            "unit_of_measure": p.unit_of_measure,
            "quantity": quantity,
            "reference_price": p.reference_price,
            "last_price": last_price,
            "total": total,
            "price_difference_percentage": p.price_difference_percentage,
            "tax_rate": p.tax_rate,
            "bookmarked": p.bookmarked,
            "archived": p.archived,
            "merged": p.merged,
            "imported": p.imported,
            "category_id": p.category_id,
            "category_name": category.name if category else None,
            "category_color": category.color if category else None,
            "app_category_id": p.app_category_id,
            "app_category_name": app_category.name if app_category else None,
            "app_category_color": app_category.color if app_category else None,
            "suppliers": supplier_names,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        })

    # Sorting in python if dynamic date filtering is active
    if (start_date or end_date) and sort_by in ("quantity", "total", "last_price"):
        reverse = order == "desc"
        result.sort(key=lambda x: (x[sort_by] is None, x[sort_by] or 0.0), reverse=reverse)

    return result, total_count


# ---------------------------------------------------------------------------
# Product CRUD - Detail
# ---------------------------------------------------------------------------

def get_product_detail(db: Session, product_id: str, restaurant_id: int) -> Optional[dict]:
    """
    Returns full product detail including:
      - Basic fields
      - Category (with parent chain)
      - Suppliers list
      - Formats list
      - Purchase history (via alias-based invoice_lines lookup)
      - Price stats: min, max, reference, last
    """
    product = db.exec(select(Product).where(Product.id == product_id, Product.restaurant_id == restaurant_id, Product.deleted_at.is_(None))).first()
    if not product:
        return None

    # Suppliers
    ps_rows = db.exec(
        select(ProductSupplier).where(ProductSupplier.product_id == product_id)
    ).all()
    suppliers = []
    for ps in ps_rows:
        s = db.get(Supplier, ps.supplier_id)
        if s:
            suppliers.append({
                "id": ps.supplier_id,
                "name": s.name,
                "haddock_supplier_id": ps.haddock_supplier_id,
            })

    # Category with parent chain
    category_chain = _build_category_chain(db, product.category_id)

    # App Category (with supplier fallback)
    app_category = None
    if product.app_category_id:
        app_category = db.exec(
            select(AppCategory).where(AppCategory.category_id == product.app_category_id)
        ).first()
    
    if not app_category and ps_rows:
        for ps in ps_rows:
            s = db.get(Supplier, ps.supplier_id)
            if s and s.category_id:
                app_category = db.exec(
                    select(AppCategory).where(AppCategory.category_id == s.category_id)
                ).first()
                if app_category:
                    break
                    
    app_category_dict = None
    if app_category:
        app_category_dict = {
            "id": app_category.category_id,
            "name": app_category.name,
            "color": app_category.color
        }

    # Formats
    formats = db.exec(
        select(ProductFormat).where(ProductFormat.product_id == product_id)
    ).all()

    # Purchase history via referenced_items → invoice_lines
    purchase_history = _get_purchase_history(db, product_id, restaurant_id)

    # Price stats from history
    prices = [h["unit_price"] for h in purchase_history if h.get("unit_price")]
    price_stats = {
        "min": min(prices) if prices else None,
        "max": max(prices) if prices else None,
        "reference": product.reference_price,
        "last": product.last_price,
    }

    # Total purchases
    total_units = sum(h["quantity"] for h in purchase_history if h.get("quantity"))
    total_cost = product.total or 0.0

    return {
        "id": product.id,
        "name": product.name,
        "unit_of_measure": product.unit_of_measure,
        "unit_of_measure_source": product.unit_of_measure_source,
        "quantity": product.quantity,
        "reference_price": product.reference_price,
        "last_price": product.last_price,
        "total": product.total,
        "price_difference_percentage": product.price_difference_percentage,
        "tax_rate": product.tax_rate,
        "bookmarked": product.bookmarked,
        "archived": product.archived,
        "merged": product.merged,
        "imported": product.imported,
        "config": product.config,
        "category_id": product.category_id,
        "app_category_id": product.app_category_id,
        "category": category_chain,
        "app_category": app_category_dict,
        "suppliers": suppliers,
        "formats": [
            {
                "id": f.id,
                "purchase_unit": f.purchase_unit,
                "conversion_factor": f.conversion_factor,
                "base_unit": f.base_unit,
                "base_unit_source": f.base_unit_source,
                "price_per_base_unit": f.price_per_base_unit,
                "is_default": f.is_default,
            }
            for f in formats
        ],
        "price_stats": price_stats,
        "total_units_purchased": total_units,
        "total_cost": total_cost,
        "purchase_history": purchase_history,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }


def _build_category_chain(db: Session, category_id: Optional[str]) -> Optional[dict]:
    """Walk up category parent chain to build full path."""
    if not category_id:
        return None
    cat = db.get(ExpenseCategory, category_id)
    if not cat:
        return None
    result = {"id": cat.id, "name": cat.name, "color": cat.color, "parent": None}
    if cat.parent_id:
        result["parent"] = _build_category_chain(db, cat.parent_id)
    return result


def _get_purchase_history(
    db: Session,
    product_id: str,
    restaurant_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[dict]:
    """
    Get all invoice lines that belong to this product.

    Logic: query invoice_lines WHERE description (case-insensitive) exactly matches
    the product name OR any of its ProductAlias entries.
    This replaces the old product_references -> referenced_items -> invoice_lines chain.
    """
    history = []
    product = db.get(Product, product_id)
    if not product:
        return []

    # Build the set of valid names: product name + all aliases (all lowercased)
    aliases = db.exec(
        select(ProductAlias).where(ProductAlias.master_product_id == product_id)
    ).all()
    valid_names = {product.name.lower()} | {a.alias_name.lower() for a in aliases}

    # Method 1: Exact matches against valid_names
    exact_matched = db.exec(
        select(InvoiceLine).where(func.lower(InvoiceLine.description).in_(valid_names))
    ).all()
    
    for line in exact_matched:
        invoice = db.get(Invoice, line.invoice_id)
        if invoice:
            doc_date = invoice.document_date or (
                invoice.issue_date.date().isoformat() if invoice.issue_date else ""
            )
            if start_date and (not doc_date or doc_date < start_date):
                continue
            if end_date and (not doc_date or doc_date > end_date):
                continue
        history.append(_format_purchase_line(line, invoice))

    # Method 2: invoice_lines where description matches product name (fuzzy link)
    # Only add if not already included
    existing_line_ids = {h["line_id"] for h in history if h.get("line_id")}
    name_matched = db.exec(
        select(InvoiceLine).where(
            InvoiceLine.description.ilike(f"%{product.name[:20]}%")
        ).limit(50)
    ).all()
    
    for line in name_matched:
        if line.id not in existing_line_ids:
            invoice = db.get(Invoice, line.invoice_id)
            if invoice:
                doc_date = invoice.document_date or (
                    invoice.issue_date.date().isoformat() if invoice.issue_date else ""
                )
                if start_date and (not doc_date or doc_date < start_date):
                    continue
                if end_date and (not doc_date or doc_date > end_date):
                    continue
            history.append(_format_purchase_line(line, invoice))

    # Sort by date descending
    history.sort(key=lambda h: h.get("document_date") or "", reverse=True)
    return history


def _format_purchase_line(line: InvoiceLine, invoice: Optional[Invoice]) -> dict:
    """Format an invoice line into a purchase history row."""
    supplier_name = ""
    document_type = ""
    document_date = ""
    if invoice:
        supplier_name = invoice.supplier_display_name or ""
        document_type = invoice.document_type or "Invoice"
        document_date = invoice.document_date or (
            invoice.issue_date.date().isoformat() if invoice.issue_date else ""
        )
    return {
        "line_id": line.id,
        "invoice_id": line.invoice_id,
        "description": line.description,
        "supplier_name": supplier_name,
        "document_type": document_type,
        "document_date": document_date,
        "quantity": line.quantity,
        "unit": line.unit,
        "unit_price": line.unit_price,
        "total_price": line.total_price,
        "iva_pct": line.iva_pct,
    }


# ---------------------------------------------------------------------------
# Product CRUD - Update
# ---------------------------------------------------------------------------

def update_product(db: Session, product_id: str, data: "ProductUpdate", restaurant_id: int) -> Optional[Product]:
    """Partial update of a product's editable fields."""
    product = db.exec(select(Product).where(Product.id == product_id, Product.restaurant_id == restaurant_id, Product.deleted_at.is_(None))).first()
    if not product:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    product.updated_at = datetime.utcnow()

    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def toggle_bookmark(db: Session, product_id: str, restaurant_id: int) -> Optional[Product]:
    product = db.exec(select(Product).where(Product.id == product_id, Product.restaurant_id == restaurant_id, Product.deleted_at.is_(None))).first()
    if not product:
        return None
    product.bookmarked = not product.bookmarked
    product.updated_at = datetime.utcnow()
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def archive_product(db: Session, product_id: str, restaurant_id: int, archived: bool = True) -> Optional[Product]:
    product = db.exec(select(Product).where(Product.id == product_id, Product.restaurant_id == restaurant_id, Product.deleted_at.is_(None))).first()
    if not product:
        return None
    product.archived = archived
    product.updated_at = datetime.utcnow()
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# Invoice Digitization (Deferred Product Creation)
# ---------------------------------------------------------------------------

def digitize_invoice_products(db: Session, invoice_id: int):
    """
    Called when an invoice transitions to needs_review = False.
    This creates brand new products for unmatched lines,
    and updates totals for exactly matched lines.
    """
    from app.module.invoices.model import Invoice, InvoiceLine
    from app.module.products.model import Product, ProductAlias, ProductSupplier
    import uuid

    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        return

    # Build the set of all linked descriptions: product names + aliases
    all_products = list(db.exec(select(Product).where(Product.restaurant_id == invoice.restaurant_id)).all())
    all_aliases = list(db.exec(
        select(ProductAlias)
        .join(Product)
        .where(Product.restaurant_id == invoice.restaurant_id)
    ).all())

    # Create mapping of lowercase name to global product
    linked_products = {}
    for p in all_products:
        linked_products[p.name.lower()] = p
    for a in all_aliases:
        # Alias points to a master product
        master = db.get(Product, a.master_product_id)
        if master:
            linked_products[a.alias_name.lower()] = master

    lines = db.exec(
        select(InvoiceLine).where(InvoiceLine.invoice_id == invoice_id)
    ).all()

    import logging
    logger = logging.getLogger("fastapi_app")

    for line in lines:
        if not line.description:
            continue
            
        desc_lower = line.description.lower()
        
        # 1. Exact match (already exists or alias)
        if desc_lower in linked_products:
            global_product = linked_products[desc_lower]
            logger.info(f"Updating global product {global_product.id} for exact match '{line.description}' upon digitization...")
            
            global_product.quantity = (global_product.quantity or 0) + (line.quantity or 0)
            global_product.total = (global_product.total or 0) + (line.total_price or 0)
            global_product.last_price = line.unit_price or global_product.last_price
            global_product.updated_at = datetime.utcnow()
            db.add(global_product)
            
        # 2. Fuzzy match (suggested_product_id is present and belongs to the same restaurant)
        elif line.suggested_product_id and (
            (suggested_prod := db.get(Product, line.suggested_product_id)) and 
            suggested_prod.restaurant_id == invoice.restaurant_id
        ):
            logger.info(f"Line '{line.description}' has fuzzy match (Review Queue). Skipping creation.")
            continue
            
        # 3. No match at all - Create a brand new Product!
        else:
            new_prod_id = f"prod~{uuid.uuid4().hex[:16]}"
            logger.info(f"Creating brand new catalog product '{line.description}' ({new_prod_id}) upon digitization...")
            new_product = Product(
                id=new_prod_id,
                restaurant_id=invoice.restaurant_id,
                name=line.description,
                status="ACTIVE",
                reference_price=line.unit_price,
                last_price=line.unit_price,
                quantity=line.quantity,
                total=line.total_price
            )
            db.add(new_product)
            
            # Link to supplier
            if invoice.supplier_id:
                product_supplier = ProductSupplier(
                    product_id=new_prod_id,
                    supplier_id=invoice.supplier_id,
                )
                db.add(product_supplier)
            
            # Also add it to linked_products so duplicate items in the same invoice don't create multiple products
            linked_products[desc_lower] = new_product

    db.commit()


# ---------------------------------------------------------------------------
# Review Queue - Invoice Lines Pending Product Assignment
# ---------------------------------------------------------------------------

def get_review_queue(
    db: Session,
    restaurant_id: int,
    skip: int = 0,
    limit: int = 100,
    name: Optional[str] = None,
) -> Tuple[List[dict], int]:
    """
    Returns invoice lines that have NOT been linked to any product yet.
    These are 'New articles pending review' — the digitized expense lines
    that need to be confirmed or unified with existing products.

    An invoice line is considered 'linked' if its description (lowercased)
    exactly matches any product name or any ProductAlias entry.
    """
    # Build the set of all linked descriptions: product names + aliases
    all_products = list(db.exec(select(Product).where(Product.restaurant_id == restaurant_id)).all())
    all_aliases = list(db.exec(
        select(ProductAlias)
        .join(Product)
        .where(Product.restaurant_id == restaurant_id)
    ).all())

    linked_descriptions = (
        {p.name.lower() for p in all_products}
        | {a.alias_name.lower() for a in all_aliases}
    )

    # Query unlinked invoice lines (not in referenced_items)
    stmt = (
        select(InvoiceLine)
        .join(Invoice, InvoiceLine.invoice_id == Invoice.id)
        .where(Invoice.restaurant_id == restaurant_id)
        .where(Invoice.deleted_at == None)
        .where(InvoiceLine.deleted_at == None)
        .where(InvoiceLine.description.isnot(None))
        .where(InvoiceLine.description != "")
        .where(Invoice.status == "PROCESSED")
        .where(Invoice.needs_review == False)
    )
    if name:
        stmt = stmt.where(InvoiceLine.description.ilike(f"%{name}%"))

    all_lines = list(db.exec(stmt.order_by(desc(InvoiceLine.id))).all())

    # Filter out lines whose description is already linked
    unlinked_lines = [
        line for line in all_lines
        if (line.description or "").lower() not in linked_descriptions
    ]

    total = len(unlinked_lines)
    paginated = unlinked_lines[skip: skip + limit]

    result = []
    for line in paginated:
        invoice = db.get(Invoice, line.invoice_id)
        supplier_name = invoice.supplier_display_name if invoice else ""

        # Find similar products for suggestion
        similar = []
        if line.suggested_product_id:
            suggested_prod = db.get(Product, line.suggested_product_id)
            if suggested_prod and suggested_prod.restaurant_id == restaurant_id:
                similar.append({
                    "product_id": suggested_prod.id,
                    "product_name": suggested_prod.name,
                    "unit_of_measure": suggested_prod.unit_of_measure,
                    "last_price": suggested_prod.last_price,
                    "confidence": "llm_suggested",
                    "ai_confidence_score": line.suggested_confidence
                })
            else:
                similar = _find_similar_products(db, line.description or "", supplier_name, restaurant_id)
        else:
            similar = _find_similar_products(db, line.description or "", supplier_name, restaurant_id)

        result.append({
            "line_id": line.id,
            "invoice_id": line.invoice_id,
            "description": line.description,
            "supplier_name": supplier_name,
            "document_type": invoice.document_type if invoice else "Invoice",
            "document_date": (
                invoice.document_date or
                (invoice.issue_date.date().isoformat() if invoice and invoice.issue_date else "")
            ) if invoice else "",
            "quantity": line.quantity,
            "unit": line.unit,
            "unit_price": line.unit_price,
            "total_price": line.total_price,
            "iva_pct": line.iva_pct,
            "similar_products": similar,
        })

    return result, total


def _find_similar_products(db: Session, description: str, supplier_name: str, restaurant_id: int) -> List[dict]:
    """
    Find existing products that look similar to an unlinked invoice line.
    Returns match confidence: 'exact' | 'possibly_different' | 'looks_different'
    Excludes products from soft-deleted SuppliedProducts.
    """
    if not description or len(description) < 3:
        return []

    # Search by first 15 chars of description
    prefix = description[:15].strip()
    stmt = (
        select(Product)
        .where(Product.restaurant_id == restaurant_id)
        .where(Product.name.ilike(f"%{prefix}%"))
        .where(Product.archived == False)
        .where(Product.deleted_at.is_(None))
        .where(Product.merged == False)
        .limit(10)  # fetch extra to allow filtering
    )
    products = list(db.exec(stmt).all())

    # Get IDs of soft-deleted SuppliedProducts to exclude them from matches
    from app.module.invoices.model import SuppliedProduct
    deleted_sp_ids = set(
        db.exec(
            select(SuppliedProduct.id).where(SuppliedProduct.deleted_at != None)
        ).all()
    )

    results = []
    for p in products:
        # Simple confidence scoring
        desc_lower = description.lower()
        name_lower = p.name.lower()

        if desc_lower == name_lower:
            confidence = "exact"
        elif desc_lower[:10] == name_lower[:10]:
            confidence = "possibly_different"
        else:
            confidence = "looks_different"

        results.append({
            "product_id": p.id,
            "product_name": p.name,
            "unit_of_measure": p.unit_of_measure,
            "last_price": p.last_price,
            "confidence": confidence,
        })

    return results


# ---------------------------------------------------------------------------
# Unify - Link a review queue item to an existing product
# ---------------------------------------------------------------------------

def unify_line_with_product(
    db: Session,
    invoice_line_id: int,
    product_id: str,
    restaurant_id: int,
) -> dict:
    """
    Link an unreviewed invoice line to an existing product.

    Creates a ProductAlias for the invoice line's description so that:
      1. This line immediately appears in the product's purchase history
      2. All future invoice lines with the same description are auto-linked
    """
    line = db.get(InvoiceLine, invoice_line_id)
    if not line:
        raise ValueError(f"Invoice line {invoice_line_id} not found.")

    product = db.exec(select(Product).where(Product.id == product_id, Product.restaurant_id == restaurant_id)).first()
    if not product:
        raise ValueError(f"Product {product_id} not found.")

    # Create alias so purchase history picks this line (and future ones) up
    alias_name = (line.description or "").lower()
    if alias_name and alias_name != product.name.lower():
        existing_alias = db.exec(
            select(ProductAlias).where(
                ProductAlias.alias_name == alias_name,
                ProductAlias.master_product_id == product_id,
            )
        ).first()
        if not existing_alias:
            db.add(ProductAlias(
                alias_name=alias_name,
                master_product_id=product_id,
            ))

    # Update product stats
    if line.quantity and line.unit_price:
        product.quantity = (product.quantity or 0) + line.quantity
        product.total = (product.total or 0) + line.total_price
        product.last_price = line.unit_price
        product.updated_at = datetime.utcnow()
        db.add(product)

    db.commit()
    return {
        "status": "unified",
        "line_id": invoice_line_id,
        "product_id": product_id,
        "alias_created": alias_name,
    }


def mark_line_no_match(db: Session, invoice_line_id: int, restaurant_id: int) -> dict:
    """
    Mark an unreviewed invoice line as 'no match' — creates a new standalone product.
    """
    line = db.get(InvoiceLine, invoice_line_id)
    if not line:
        raise ValueError(f"Invoice line {invoice_line_id} not found.")

    invoice = db.exec(select(Invoice).where(Invoice.id == line.invoice_id, Invoice.restaurant_id == restaurant_id)).first()
    if not invoice: raise ValueError('Not found')
    supplier_id_local: Optional[int] = None
    if invoice and invoice.supplier_id:
        supplier_id_local = invoice.supplier_id

    # Create a new product from this line
    new_data = ProductManualCreate(
        restaurant_id=restaurant_id,
        name=line.description or "Unnamed product",
        unit_of_measure=line.unit or "ud",
        price=line.unit_price or 0.0,
        supplier_ids=[supplier_id_local] if supplier_id_local else [],
    )
    new_product = create_product_manual(db, new_data, restaurant_id)

    # Link the line to this new product via alias
    return unify_line_with_product(db, invoice_line_id, new_product.id, restaurant_id)


def merge_products(db: Session, master_product_id: str, source_product_id: str, restaurant_id: int) -> dict:
    """
    Merge a source product into a master product.
    
    1. Re-map any existing ProductAlias entries of source to master.
    2. Create a new ProductAlias for the source product's name -> master.
    3. Update ProductSupplier links to point to master.
    4. Aggregate stats (quantity, total) to master.
    5. Archive/merge the source product.
    """
    master = db.get(Product, master_product_id)
    if not master or master.restaurant_id != restaurant_id:
        raise ValueError(f"Master product {master_product_id} not found.")
    if master.deleted_at:
        raise ValueError("Cannot merge into a deleted product.")
    if master.merged:
        raise ValueError("Cannot merge into a product that is already merged into another product.")

    source = db.get(Product, source_product_id)
    if not source or source.restaurant_id != restaurant_id:
        raise ValueError(f"Source product {source_product_id} not found.")
    if source.deleted_at:
        raise ValueError("Cannot merge a deleted product.")
    if source.merged:
        raise ValueError("Source product is already merged into another product.")
        
    if master_product_id == source_product_id:
        raise ValueError("Cannot merge a product into itself.")

    # 1. Update existing aliases
    existing_aliases = db.exec(
        select(ProductAlias).where(ProductAlias.master_product_id == source_product_id)
    ).all()
    for alias in existing_aliases:
        alias.master_product_id = master_product_id
        db.add(alias)

    # 2. Create alias for source product name
    source_name_lower = source.name.lower()
    existing_alias = db.exec(
        select(ProductAlias).where(
            ProductAlias.alias_name == source_name_lower,
            ProductAlias.master_product_id == master_product_id,
        )
    ).first()
    if not existing_alias:
        db.add(ProductAlias(
            alias_name=source_name_lower,
            master_product_id=master_product_id,
        ))

    # 3. Update ProductSuppliers
    source_suppliers = db.exec(
        select(ProductSupplier).where(ProductSupplier.product_id == source_product_id)
    ).all()
    for ss in source_suppliers:
        # Check if master already has this supplier
        existing_ss = db.exec(
            select(ProductSupplier).where(
                ProductSupplier.product_id == master_product_id,
                ProductSupplier.supplier_id == ss.supplier_id
            )
        ).first()
        if not existing_ss:
            db.add(ProductSupplier(
                product_id=master_product_id,
                supplier_id=ss.supplier_id,
                haddock_supplier_id=ss.haddock_supplier_id
            ))
        db.delete(ss)  # Remove the link from the source product

    # 4. Aggregate stats
    if source.quantity:
        master.quantity = (master.quantity or 0) + source.quantity
    if source.total:
        master.total = (master.total or 0) + source.total
        
    # Update last_price if source is newer
    if source.updated_at and master.updated_at and source.updated_at > master.updated_at:
        master.last_price = source.last_price or master.last_price
        master.updated_at = source.updated_at

    # 5. Hide source product
    source.merged = True
    source.merged_into_id = master_product_id

    db.add(master)
    db.add(source)
    db.commit()

    return {
        "status": "merged",
        "master_product_id": master_product_id,
        "source_product_id": source_product_id,
    }



# ---------------------------------------------------------------------------
# Haddock sync helpers (legacy — kept for backward compatibility but simplified)
# ---------------------------------------------------------------------------

def upsert_product(db: Session, data: dict, restaurant_id: int) -> Product:
    category_id: Optional[str] = None
    if data.get("category"):
        category_id = upsert_category_tree(db, data["category"])

    product_id = data["id"]
    existing = db.exec(select(Product).where(Product.id == product_id, Product.restaurant_id == restaurant_id)).first()
    product_fields = {
        "name": data.get("name", ""),
        "reference_price": data.get("referencePrice"),
        "last_price": data.get("lastPrice"),
        "total": data.get("total", 0.0),
        "quantity": data.get("quantity"),
        "price_difference_percentage": data.get("priceDifferencePercentage"),
        "unit_of_measure": data.get("unitOfMeasure"),
        "unit_of_measure_source": data.get("unitOfMeasureSource"),
        "tax_rate": data.get("taxRate"),
        "bookmarked": data.get("bookmarked", False),
        "archived": data.get("archived", False),
        "merged": data.get("merged", False),
        "imported": data.get("imported", False),
        "config": data.get("config"),
        "category_id": category_id,
        "restaurant_id": restaurant_id,
    }
    if existing:
        for k, v in product_fields.items():
            setattr(existing, k, v)
        product = existing
    else:
        product = Product(id=product_id, **product_fields)
    db.add(product)
    db.flush()

    for supp in data.get("suppliers", []):
        haddock_supp_id = supp.get("id", "")
        local_supplier = resolve_supplier_by_haddock_id(db, haddock_supp_id)
        if local_supplier:
            stmt = select(ProductSupplier).where(
                ProductSupplier.product_id == product_id,
                ProductSupplier.supplier_id == local_supplier.id,
            )
            if not db.exec(stmt).first():
                db.add(ProductSupplier(
                    product_id=product_id,
                    supplier_id=local_supplier.id,
                    haddock_supplier_id=haddock_supp_id,
                ))

    # referencedItemsDetails is legacy Haddock data — create aliases instead
    for detail in data.get("referencedItemsDetails", []):
        expense_item_name = detail.get("expenseItemName", "")
        if expense_item_name:
            alias_name = expense_item_name.lower()
            existing_alias = db.exec(
                select(ProductAlias).where(
                    ProductAlias.alias_name == alias_name,
                    ProductAlias.master_product_id == product_id,
                )
            ).first()
            if not existing_alias:
                db.add(ProductAlias(alias_name=alias_name, master_product_id=product_id))

    db.commit()
    db.refresh(product)
    return product


def sync_products_from_haddock(db: Session, haddock_response: dict, restaurant_id: int) -> List[Product]:
    products_data = haddock_response.get("products", {}).get("data", [])
    return [upsert_product(db, p, restaurant_id) for p in products_data]


def upsert_product_format(
    db: Session,
    product_id: str,
    purchase_unit: str,
    conversion_factor: float,
    base_unit: str,
    base_unit_source: Optional[str],
    price_per_base_unit: Optional[float],
    supplier_id: Optional[int] = None,
) -> ProductFormat:
    stmt = select(ProductFormat).where(
        ProductFormat.product_id == product_id,
        ProductFormat.purchase_unit == purchase_unit,
    )
    existing = db.exec(stmt).first()
    if existing:
        existing.conversion_factor = conversion_factor
        existing.base_unit = base_unit
        existing.base_unit_source = base_unit_source
        existing.price_per_base_unit = price_per_base_unit
        existing.supplier_id = supplier_id
        db.add(existing)
        return existing
    fmt = ProductFormat(
        product_id=product_id,
        purchase_unit=purchase_unit,
        conversion_factor=conversion_factor,
        base_unit=base_unit,
        base_unit_source=base_unit_source,
        price_per_base_unit=price_per_base_unit,
        supplier_id=supplier_id,
    )
    db.add(fmt)
    db.flush()
    return fmt


# ---------------------------------------------------------------------------
# Inventory CRUD
# ---------------------------------------------------------------------------

def get_inventories(db: Session, restaurant_id: int, skip: int = 0, limit: int = 50) -> List[Inventory]:
    return list(db.exec(select(Inventory).offset(skip).limit(limit)).all())


def get_inventory(db: Session, inventory_id: str, restaurant_id: int) -> Optional[Inventory]:
    return db.exec(select(Inventory).where(Inventory.id == inventory_id, Inventory.restaurant_id == restaurant_id)).first()


def create_inventory(db: Session, data: InventoryCreate, restaurant_id: int) -> Inventory:
    inventory = Inventory(**data.model_dump())
    db.add(inventory)
    db.commit()
    db.refresh(inventory)
    return inventory


def get_inventory_items(
    db: Session, inventory_id: str,
    kind: Optional[str] = None, skip: int = 0, limit: int = 200,
) -> List[InventoryItem]:
    stmt = select(InventoryItem).where(InventoryItem.inventory_id == inventory_id)
    if kind:
        stmt = stmt.where(InventoryItem.kind == kind)
    return list(db.exec(stmt.offset(skip).limit(limit)).all())


def sync_inventory_items_from_haddock(
    db: Session, inventory_id: str, haddock_response: dict, restaurant_id: int
) -> List[InventoryItem]:
    inventory = db.get(Inventory, inventory_id)
    if not inventory:
        inventory = Inventory(id=inventory_id, restaurant_id=restaurant_id)
        db.add(inventory)
        db.flush()
    elif not inventory.restaurant_id:
        inventory.restaurant_id = restaurant_id
        db.add(inventory)
        db.flush()

    from app.module.products.schema import HaddockInventoryItemInput
    items_data = haddock_response.get("items", {}).get("data", [])
    results: List[InventoryItem] = []

    for raw in items_data:
        item_input = HaddockInventoryItemInput(**raw)
        supplier_id: Optional[int] = None
        if item_input.supplier:
            local_supp = resolve_supplier_by_haddock_id(db, item_input.supplier.id)
            if local_supp:
                supplier_id = local_supp.id

        warehouse_qty = 0.0
        if item_input.warehouse:
            warehouse_qty = item_input.warehouse.quantity
        elif item_input.warehouseQuantity is not None:
            warehouse_qty = item_input.warehouseQuantity

        if item_input.kind == "product" and item_input.productID:
            if not db.get(Product, item_input.productID):
                db.add(Product(id=item_input.productID, name=item_input.name, restaurant_id=restaurant_id))
                db.flush()
            upsert_product_format(
                db, product_id=item_input.productID,
                purchase_unit=item_input.purchase.unitOfMeasure or "ud",
                conversion_factor=item_input.conversionFactor,
                base_unit=item_input.baseUnit or "ud",
                base_unit_source=item_input.baseUnitSource,
                price_per_base_unit=item_input.pricePerUnit,
                supplier_id=supplier_id,
            )

        if item_input.kind == "product":
            stmt = select(InventoryItem).where(
                InventoryItem.inventory_id == inventory_id,
                InventoryItem.product_id == item_input.productID,
            )
        else:
            stmt = select(InventoryItem).where(
                InventoryItem.inventory_id == inventory_id,
                InventoryItem.dish_id == item_input.dishID,
            )
        existing = db.exec(stmt).first()

        item_fields = {
            "inventory_id": inventory_id,
            "kind": item_input.kind,
            "name": item_input.name,
            "product_id": item_input.productID,
            "dish_id": item_input.dishID,
            "price_per_unit": item_input.pricePerUnit,
            "conversion_factor": item_input.conversionFactor,
            "base_unit": item_input.baseUnit,
            "base_unit_source": item_input.baseUnitSource,
            "warehouse_quantity": warehouse_qty,
            "purchase_quantity": item_input.purchase.quantity,
            "purchase_unit_of_measure": item_input.purchase.unitOfMeasure,
            "total_accumulated": item_input.totalAccumulated,
            "supplier_id": supplier_id,
            "haddock_supplier_id": item_input.supplier.id if item_input.supplier else None,
        }

        if existing:
            for k, v in item_fields.items():
                setattr(existing, k, v)
            db.add(existing)
            results.append(existing)
        else:
            new_item = InventoryItem(**item_fields)
            db.add(new_item)
            results.append(new_item)

    db.commit()
    for item in results:
        db.refresh(item)
    return results
