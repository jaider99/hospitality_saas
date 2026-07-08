"""
Products & Inventory API Router
=================================

Products:
  POST   /api/v1/products                          - Create product manually
  GET    /api/v1/products                          - List products (with filters)
  GET    /api/v1/products/{product_id}             - Product detail (history, stats, formats)
  PATCH  /api/v1/products/{product_id}             - Update product fields
  PATCH  /api/v1/products/{product_id}/bookmark    - Toggle bookmark
  PATCH  /api/v1/products/{product_id}/archive     - Archive/unarchive
  POST   /api/v1/products/sync                     - Bulk sync from Haddock API

Categories:
  GET    /api/v1/products/categories               - List all categories

Review Queue (new articles pending review):
  GET    /api/v1/products/review-queue             - Pending unlinked invoice lines
  POST   /api/v1/products/review-queue/{line_id}/unify     - Merge line into product
  POST   /api/v1/products/review-queue/{line_id}/no-match  - Create new product from line

Inventories:
  GET    /api/v1/inventories                       - List inventory sessions
  GET    /api/v1/inventories/{id}                  - Get session
  POST   /api/v1/inventories                       - Create session
  GET    /api/v1/inventories/{id}/items            - List items
  POST   /api/v1/inventories/{id}/sync             - Sync from Haddock API
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session
from typing import List, Optional

from app.db.session import get_db as get_session
from app.module.products import service
from app.module.products.schema import (
    ProductManualCreate,
    ProductUpdate,
    ProductListRow,
    ProductListResponse,
    ProductDetail,
    ReviewQueueResponse,
    ReviewQueueItem,
    UnifyRequest,
    InventoryRead,
    InventoryCreate,
    InventoryItemRead,
    InventoryItemsResponse,
    CategoryRead,
)

router = APIRouter()


# ===========================================================================
# CATEGORIES
# ===========================================================================

@router.get(
    "/products/categories",
    response_model=List[CategoryRead],
    summary="List Expense Categories",
    tags=["Products & Inventory"],
)
def list_categories(db: Session = Depends(get_session)):
    """
    Return all expense categories for use in product create/edit dropdowns.
    """
    cats = service.get_categories(db)
    return [
        CategoryRead(
            id=c.id, name=c.name, color=c.color, parent_id=c.parent_id
        )
        for c in cats
    ]


# ===========================================================================
# PRODUCTS — CREATE / LIST / DETAIL / UPDATE
# ===========================================================================

@router.post(
    "/products",
    response_model=ProductDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create Product Manually",
    tags=["Products & Inventory"],
)
def create_product(
    payload: ProductManualCreate,
    db: Session = Depends(get_session),
):
    """
    Manually create a product.

    Maps to the Haddock 'Create product manually' form with:
    - **Basic info**: name, product_code, supplier_ids, category_id
    - **Purchases**: price, unit_of_measure, shrinkage_pct, tax_rate
    """
    product = service.create_product_manual(db, payload)
    detail = service.get_product_detail(db, product.id)
    return detail


@router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Product",
    tags=["Products & Inventory"],
)
def delete_product(product_id: str, db: Session = Depends(get_session)):
    try:
        service.delete_product(db, product_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return None

from pydantic import BaseModel
class BulkDeleteProductsRequest(BaseModel):
    product_ids: List[str]

@router.post(
    "/products/bulk-delete",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Bulk Delete Products",
    tags=["Products & Inventory"],
)
def bulk_delete_products(payload: BulkDeleteProductsRequest, db: Session = Depends(get_session)):
    try:
        service.bulk_delete_products(db, payload.product_ids)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return None

@router.get(
    "/products",
    response_model=ProductListResponse,
    summary="List Products",
    tags=["Products & Inventory"],
)
def list_products(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=500),
    name: Optional[str] = Query(default=None, description="Search by product name"),
    archived: Optional[bool] = Query(default=None),
    bookmarked: Optional[bool] = Query(default=None),
    category_id: Optional[str] = Query(default=None),
    supplier_id: Optional[int] = Query(default=None),
    sort_by: str = Query(default="name", description="Sort field: name | total | last_price | quantity"),
    order: str = Query(default="asc", description="asc | desc"),
    start_date: Optional[str] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_session),
):
    """
    List all products with the same columns shown in the Haddock products table:
    Product name | Supplier | Categories | Quantity | Ref. price | Latest price | Total

    Also returns `pending_review_count` (articles pending review badge).
    """
    items, total = service.get_products(
        db, skip=skip, limit=limit,
        archived=archived, bookmarked=bookmarked,
        category_id=category_id, supplier_id=supplier_id,
        name=name, sort_by=sort_by, order=order,
        start_date=start_date, end_date=end_date,
    )

    # Count pending review items for the banner
    _, pending_count = service.get_review_queue(db, skip=0, limit=1)

    return ProductListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        pending_review_count=pending_count,
    )


@router.get(
    "/products/review-queue",
    response_model=ReviewQueueResponse,
    summary="Review Queue — New Articles Pending Review",
    tags=["Products & Inventory"],
)
def get_review_queue(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=500),
    name: Optional[str] = Query(default=None, description="Search by description"),
    db: Session = Depends(get_session),
):
    """
    Returns unlinked invoice lines that need review before being added to the
    product database — the 'New articles pending review' section.

    Each item includes:
    - Description, supplier, quantity, nominal price (from invoice line)
    - `similar_products`: suggested existing products to unify with, with confidence:
      - `exact` — name matches exactly
      - `possibly_different` — looks similar
      - `looks_different` — name prefix matches loosely
    """
    items, total = service.get_review_queue(db, skip=skip, limit=limit, name=name)
    return ReviewQueueResponse(items=items, total=total, skip=skip, limit=limit)


@router.get(
    "/products/{product_id}",
    response_model=ProductDetail,
    summary="Get Product Detail",
    tags=["Products & Inventory"],
)
def get_product(product_id: str, db: Session = Depends(get_session)):
    """
    Full product detail view including:
    - Price stats: latest price, reference price, max/min historical prices
    - Total purchases (units + cost)
    - Purchase history tab: all invoice lines linked to this product
    - Formats: purchase units with conversion factors to base unit
    - Category (with parent chain)
    - Linked suppliers
    """
    detail = service.get_product_detail(db, product_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product '{product_id}' not found.",
        )
    return detail


@router.patch(
    "/products/{product_id}",
    response_model=ProductDetail,
    summary="Update Product",
    tags=["Products & Inventory"],
)
def update_product(
    product_id: str,
    payload: ProductUpdate,
    db: Session = Depends(get_session),
):
    """
    Partially update a product's editable fields:
    name, reference_price, unit_of_measure, tax_rate, category_id, config, etc.
    """
    updated = service.update_product(db, product_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")
    return service.get_product_detail(db, product_id)


@router.patch(
    "/products/{product_id}/bookmark",
    summary="Toggle Product Bookmark",
    tags=["Products & Inventory"],
)
def toggle_bookmark(product_id: str, db: Session = Depends(get_session)):
    """Toggle the bookmarked (starred) flag on a product."""
    result = service.toggle_bookmark(db, product_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")
    return {"product_id": product_id, "bookmarked": result.bookmarked}


@router.patch(
    "/products/{product_id}/archive",
    summary="Archive / Unarchive Product",
    tags=["Products & Inventory"],
)
def archive_product(
    product_id: str,
    archived: bool = Query(default=True, description="True to archive, False to restore"),
    db: Session = Depends(get_session),
):
    """Archive or restore a product from the product list."""
    result = service.archive_product(db, product_id, archived=archived)
    if not result:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")
    return {"product_id": product_id, "archived": result.archived}


@router.post(
    "/products/sync",
    summary="Sync Products from Haddock API",
    tags=["Products & Inventory"],
)
def sync_products(payload: dict, db: Session = Depends(get_session)):
    """
    Bulk upsert products from raw Haddock /products API JSON response.
    ```json
    { "products": { "data": [ { "id": "prod~...", ... } ] } }
    ```
    """
    synced = service.sync_products_from_haddock(db, payload)
    return {"synced": len(synced), "status": "ok"}


# ===========================================================================
# REVIEW QUEUE — UNIFY / NO MATCH
# ===========================================================================

@router.post(
    "/products/review-queue/{line_id}/unify",
    summary="Unify Pending Line with Existing Product",
    tags=["Products & Inventory"],
)
def unify_with_product(
    line_id: int,
    payload: UnifyRequest,
    db: Session = Depends(get_session),
):
    """
    Link an unreviewed invoice line to an existing product (the 'Unify' button).

    - Creates a ReferencedItem for this invoice line
    - Adds a ProductReference linking it to the chosen product
    - Updates the product's stats (quantity, total, last_price)
    """
    try:
        result = service.unify_line_with_product(db, line_id, payload.product_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/products/review-queue/{line_id}/no-match",
    summary="Create New Product from Pending Line",
    status_code=status.HTTP_201_CREATED,
    tags=["Products & Inventory"],
)
def mark_no_match(line_id: int, db: Session = Depends(get_session)):
    """
    Mark an unreviewed invoice line as 'No match' — creates a new product
    from this invoice line and links it immediately.

    Maps to the 'No match' button in the review queue UI.
    """
    try:
        result = service.mark_line_no_match(db, line_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ===========================================================================
# INVENTORIES
# ===========================================================================

@router.get(
    "/inventories",
    response_model=List[InventoryRead],
    summary="List Inventory Sessions",
    tags=["Products & Inventory"],
)
def list_inventories(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_session),
):
    return service.get_inventories(db, skip=skip, limit=limit)


@router.get(
    "/inventories/{inventory_id}",
    response_model=InventoryRead,
    summary="Get Inventory Session",
    tags=["Products & Inventory"],
)
def get_inventory(inventory_id: str, db: Session = Depends(get_session)):
    inv = service.get_inventory(db, inventory_id)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Inventory '{inventory_id}' not found.")
    return inv


@router.post(
    "/inventories",
    response_model=InventoryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Inventory Session",
    tags=["Products & Inventory"],
)
def create_inventory(payload: InventoryCreate, db: Session = Depends(get_session)):
    return service.create_inventory(db, payload)


@router.get(
    "/inventories/{inventory_id}/items",
    response_model=InventoryItemsResponse,
    summary="List Inventory Items",
    tags=["Products & Inventory"],
)
def list_inventory_items(
    inventory_id: str,
    kind: Optional[str] = Query(default=None, description="'product' or 'dish'"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, le=1000),
    db: Session = Depends(get_session),
):
    items = service.get_inventory_items(db, inventory_id, kind=kind, skip=skip, limit=limit)
    return InventoryItemsResponse(items=items, total=len(items))


@router.post(
    "/inventories/{inventory_id}/sync",
    summary="Sync Inventory Items from Haddock API",
    tags=["Products & Inventory"],
)
def sync_inventory_items(
    inventory_id: str,
    payload: dict,
    db: Session = Depends(get_session),
):
    """
    Bulk upsert from Haddock /inventories/{id}/items JSON response.
    ```json
    { "items": { "data": [ { "kind": "product", ... } ] } }
    ```
    """
    synced = service.sync_inventory_items_from_haddock(db, inventory_id, payload)
    return {"inventory_id": inventory_id, "synced": len(synced), "status": "ok"}
