# Database Dependency Map

This document describes all Foreign Key relationships in the hospitality SaaS database.
It shows which tables depend on which, and what happens when a parent record is deleted.

---

## Legend

| Symbol | Delete Rule | Meaning |
|--------|-------------|---------|
| 🟢 **CASCADE** | `ON DELETE CASCADE` | Deleting the parent **automatically deletes** all child rows |
| 🔴 **NO ACTION** | `ON DELETE NO ACTION` | Deleting the parent is **blocked** if child rows still exist |
| 🟡 **SET NULL** | `ON DELETE SET NULL` | Deleting the parent **sets the FK column to NULL** in the child |

---

## Core Business Tables

### `suppliers`
The top-level owner of invoices, products, and contacts.

| Child Table | Column | Rule | Description |
|-------------|--------|------|-------------|
| `invoices` | `supplier_id` | 🟢 CASCADE | Deleting a supplier deletes all its invoices |
| `suppliedproduct` | `supplier_id` | 🟢 CASCADE | Deletes the legacy (Haddock) product records for that supplier |
| `product_suppliers` | `supplier_id` | 🟢 CASCADE | Removes the supplier↔product junction rows |
| `supplier_contacts` | `supplier_id` | 🟢 CASCADE | Deletes all contact persons linked to the supplier |
| `inventory_items` | `supplier_id` | 🔴 NO ACTION | **Blocks deletion** if inventory items still reference this supplier |

---

### `invoices`
An uploaded invoice document belonging to a supplier.

| Child Table | Column | Rule | Description |
|-------------|--------|------|-------------|
| `invoice_lines` | `invoice_id` | 🟢 CASCADE | Deleting an invoice deletes all its line items |
| `invoicetaxbracket` | `invoice_id` | 🟢 CASCADE | Deletes the tax bracket rows tied to the invoice |

---

### `invoice_lines`
Individual product line items extracted from an invoice via OCR.

| Child Table | Column | Rule | Description |
|-------------|--------|------|-------------|
| `referenced_items` | `invoice_line_id` | 🟢 CASCADE | Deleting a line item deletes the raw reference record tied to it |
| `suppliedproduct` | (via product_id) | 🟡 SET NULL | If the legacy product is deleted, the FK on the line is set to NULL (line is preserved) |

> ⚠️ **Note:** The CASCADE on `referenced_items` was manually applied after the initial migration.
> Without it, any invoice with processed products could not be deleted.

---

### `products` *(New Products Module)*
Normalized product records created from OCR line items.

| Child Table | Column | Rule | Description |
|-------------|--------|------|-------------|
| `product_references` | `product_id` | 🟢 CASCADE | Deletes junction rows linking the product to raw referenced items |
| `product_formats` | `product_id` | 🟢 CASCADE | Deletes any format/unit variants of the product |
| `product_suppliers` | `product_id` | 🟢 CASCADE | Removes the product↔supplier junction rows |
| `product_aliases` | `master_product_id` | 🔴 NO ACTION | **Blocks deletion** if the product has known aliases (name variants) |
| `inventory_items` | `product_id` | 🔴 NO ACTION | **Blocks deletion** if the product is part of an active inventory session |

---

### `referenced_items`
Raw expense/invoice line records — the bridge between invoices and the Products module.

| Child Table | Column | Rule | Description |
|-------------|--------|------|-------------|
| `product_references` | `referenced_item_id` | 🟢 CASCADE | Deletes the junction row when the referenced item is deleted |
| `inventory_items` | `referenced_item_id` | 🔴 NO ACTION | **Blocks deletion** if the item is used in an inventory session |
| `product_formats` | `haddock_referenced_id` | 🔴 NO ACTION | **Blocks deletion** if a product format is still tied to this item |

---

### `categories` *(App Categories)*
Hierarchical product categories managed within the app.

| Child Table | Column | Rule | Description |
|-------------|--------|------|-------------|
| `categories` | `parent_category_id` | 🔴 NO ACTION | **Blocks deletion** of a category that has sub-categories |
| `products` | `app_category_id` | 🔴 NO ACTION | **Blocks deletion** if any product is assigned to this category |
| `suppliers` | `category_id` | 🔴 NO ACTION | **Blocks deletion** if a supplier is assigned to this category |

---

### `expense_categories` *(Haddock Legacy Categories)*
Categories imported from the Haddock API.

| Child Table | Column | Rule | Description |
|-------------|--------|------|-------------|
| `expense_categories` | `parent_id` | 🔴 NO ACTION | **Blocks deletion** of a parent category that has children |
| `products` | `category_id` | 🔴 NO ACTION | **Blocks deletion** if products reference this category |

---

### Other Tables

| Parent | Child | Column | Rule | Description |
|--------|-------|--------|------|-------------|
| `inventories` | `inventory_items` | `inventory_id` | 🟢 CASCADE | Deleting an inventory session deletes all its items |
| `recipe` | `recipeingredient` | `recipe_id` | 🟢 CASCADE | Deleting a recipe deletes its ingredients |
| `recipe` | `inventory_items` | `recipe_id` | 🔴 NO ACTION | Can't delete a recipe if it's part of an inventory item |
| `suppliedproduct` | `productcosthistory` | `product_id` | 🟢 CASCADE | Deletes price history when a legacy product is deleted |
| `suppliedproduct` | `recipeingredient` | `product_id` | 🟢 CASCADE | Deletes recipe ingredient rows tied to a legacy product |
| `staffmember` | `staffshift` | `staff_id` | 🟢 CASCADE | Deleting a staff member deletes their shifts |
| `staffposition` | `staffemployee` | `position_id` | 🔴 NO ACTION | Can't delete a position if employees still hold it |
| `restaurant` | `user` | `restaurant_id` | 🔴 NO ACTION | Can't delete a restaurant if users are still linked |
| `user` | `restaurant` | `owner_id` | 🔴 NO ACTION | Can't delete a user who owns a restaurant |

---

## Full Deletion Chain (Invoice Lifecycle)

The key chain for safely deleting an invoice end-to-end:

```
Supplier (🟢)
  └── Invoice (🟢)
        └── InvoiceLine (🟢)
              └── ReferencedItem (🟢)
                    └── ProductReference junction row
```

All four levels cascade automatically. Once all `product_references` junction rows
are gone, the `products` table entry can also be safely deleted independently.

---

## Safe Deletion Order (Manual)

If you need to delete data manually without relying on CASCADE, follow this order:

1. `product_references` (junction — unlink products from referenced items)
2. `referenced_items`
3. `invoice_lines`
4. `invoicetaxbracket`
5. `invoices`
6. `supplier_contacts`
7. `suppliedproduct` / `product_suppliers`
8. `suppliers`
