from sqlmodel import Session, select
from fastapi import HTTPException, status
from typing import List, Dict, Any, Optional

from app.module.recipes.model import Recipe, RecipeIngredient, RecipeTag
from app.module.invoices.model import SuppliedProduct, Supplier
from app.module.recipes.schema import RecipeCreate, RecipeUpdate, IngredientAdd, RecipeTagResponse

def create_recipe(db: Session, dto: RecipeCreate, restaurant_id: int) -> Recipe:
    """Creates a new recipe item matching Haddock schema details."""
    recipe = Recipe(
        restaurant_id=restaurant_id,
        name=dto.name,
        dish_id=dto.dishId or f"dish~{dto.name.lower().replace(' ', '_')}",
        is_preparation=dto.isPreparation or False,
        unit_of_measure=dto.unitOfMeasure or "ud",
        tag_id=dto.tagId,
        tag_name=dto.tagName,
        base_price=dto.base or 0.0,
        tax_amount=dto.tax or 0.0,
        target_cost_percentage=dto.targetCostPercentage or 30.0,
        sale_price=dto.salePrice or (dto.base or 0.0) + (dto.tax or 0.0),
        notes=dto.notes,
        image_url=dto.imageUrl
    )
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe

def add_ingredient(db: Session, recipe_id: int, dto: IngredientAdd, restaurant_id: int) -> RecipeIngredient:
    """Attaches an ingredient (supplied product or sub-recipe) to a recipe."""
    statement = select(Recipe).where(Recipe.id == recipe_id, Recipe.restaurant_id == restaurant_id)
    recipe = db.exec(statement).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Recipe with ID {recipe_id} not found")
        
    if dto.productId is not None:
        product = db.get(SuppliedProduct, dto.productId)
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"SuppliedProduct with ID {dto.productId} not found")
        ingredient = RecipeIngredient(
            recipe_id=recipe_id,
            product_id=dto.productId,
            quantity=dto.quantity
        )
    elif dto.childRecipeId is not None:
        child_recipe = db.get(Recipe, dto.childRecipeId)
        if not child_recipe:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Child Recipe (Preparation) with ID {dto.childRecipeId} not found")
        ingredient = RecipeIngredient(
            recipe_id=recipe_id,
            child_recipe_id=dto.childRecipeId,
            quantity=dto.quantity
        )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Must provide either productId or childRecipeId")

    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)
    return ingredient

def get_recipes(db: Session, restaurant_id: int, is_preparation: Optional[bool] = None) -> List[Dict[str, Any]]:
    """Lists all recipes (dishes or preparations) enriched with costing details."""
    statement = select(Recipe).where(Recipe.restaurant_id == restaurant_id)
    if is_preparation is not None:
        statement = statement.where(Recipe.is_preparation == is_preparation)
    statement = statement.order_by(Recipe.name.asc())
    recipes = db.exec(statement).all()
    
    return [enrich_recipe_data(r) for r in recipes]

def get_unlinked_dishes(db: Session, restaurant_id: int) -> List[Dict[str, Any]]:
    """Returns dishes (not preparations) that have no ingredients."""
    # Find recipes where is_preparation is False and no ingredients exist
    statement = select(Recipe).where(Recipe.is_preparation == False, Recipe.restaurant_id == restaurant_id)
    recipes = db.exec(statement).all()
    
    unlinked = []
    for r in recipes:
        if not r.ingredients:
            unlinked.append({
                "id": r.dish_id or f"dish~{r.id}",
                "name": r.name,
                "tagName": r.tag_name
            })
    return unlinked

def get_recipe_details(db: Session, recipe_id: int, restaurant_id: int) -> Dict[str, Any]:
    """Retrieves full recipe details enriched with metrics or raises 404."""
    statement = select(Recipe).where(Recipe.id == recipe_id, Recipe.restaurant_id == restaurant_id)
    recipe = db.exec(statement).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Recipe with ID {recipe_id} not found")
    return enrich_recipe_data(recipe)

def update_recipe(db: Session, recipe_id: int, dto: RecipeUpdate, restaurant_id: int) -> Recipe:
    """Modifies an existing recipe's parameters."""
    statement = select(Recipe).where(Recipe.id == recipe_id, Recipe.restaurant_id == restaurant_id)
    recipe = db.exec(statement).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Recipe with ID {recipe_id} not found")
        
    if dto.name is not None:
        recipe.name = dto.name
    if dto.dishId is not None:
        recipe.dish_id = dto.dishId
    if dto.isPreparation is not None:
        recipe.is_preparation = dto.isPreparation
    if dto.unitOfMeasure is not None:
        recipe.unit_of_measure = dto.unitOfMeasure
    if dto.tagId is not None:
        recipe.tag_id = dto.tagId
    if dto.tagName is not None:
        recipe.tag_name = dto.tagName
    if dto.base is not None:
        recipe.base_price = dto.base
    if dto.tax is not None:
        recipe.tax_amount = dto.tax
    if dto.targetCostPercentage is not None:
        recipe.target_cost_percentage = dto.targetCostPercentage
    if dto.salePrice is not None:
        recipe.sale_price = dto.salePrice
    if dto.notes is not None:
        recipe.notes = dto.notes
    if dto.imageUrl is not None:
        recipe.image_url = dto.imageUrl
        
    # Auto-adjust sale_price if base or tax changed but salePrice was not explicitly updated
    if (dto.base is not None or dto.tax is not None) and dto.salePrice is None:
        recipe.sale_price = recipe.base_price + recipe.tax_amount

    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe

def delete_recipe(db: Session, recipe_id: int, restaurant_id: int) -> Recipe:
    """Removes a recipe from the database."""
    try:
        statement = select(Recipe).where(Recipe.id == recipe_id, Recipe.restaurant_id == restaurant_id)
        recipe = db.exec(statement).first()
        if not recipe:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Recipe with ID {recipe_id} not found")
        
        db.delete(recipe)
        db.commit()
        return recipe
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete recipe: {str(e)}")

def remove_ingredient(db: Session, ingredient_id: int) -> RecipeIngredient:
    """Detaches an ingredient from its recipe."""
    try:
        ingredient = db.get(RecipeIngredient, ingredient_id)
        if not ingredient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"RecipeIngredient with ID {ingredient_id} not found")
        
        db.delete(ingredient)
        db.commit()
        return ingredient
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete ingredient: {str(e)}")

def _calculate_ingredient_cost(ing: RecipeIngredient, visited: set) -> float:
    """Helper to recursively calculate cost of a single recipe ingredient."""
    if ing.product_id:
        product = ing.product
        if product:
            return (product.current_price or 0.0) * ing.quantity
    elif ing.child_recipe_id:
        child = ing.child_recipe
        if child and child.id not in visited:
            visited.add(child.id)
            child_cost = sum(_calculate_ingredient_cost(child_ing, visited) for child_ing in child.ingredients)
            visited.remove(child.id)
            return child_cost * ing.quantity
    return 0.0

def enrich_recipe_data(recipe: Recipe) -> Dict[str, Any]:
    """Enriches recipe DTO with costings, margins, errors and child elements mapping to Haddock format."""
    total_cost = 0.0
    linked_articles = []
    
    for ing in recipe.ingredients:
        cost_contrib = _calculate_ingredient_cost(ing, {recipe.id})
        total_cost += cost_contrib
        
        if ing.product_id and ing.product:
            product = ing.product
            suppliers_list = []
            if product.supplier:
                suppliers_list.append({
                    "id": f"supp~{product.supplier.id}",
                    "name": product.supplier.name
                })
            
            linked_articles.append({
                "ingredientID": f"prod~{product.id}",
                "ingredientLineID": str(ing.id),
                "ingredientType": "product",
                "name": product.name,
                "quantity": ing.quantity,
                "displayUnit": product.unit or "ud",
                "shrinkage": 0.0,
                "shrinkageType": "absolute",
                "netQuantity": ing.quantity,
                "lastPrice": product.current_price,
                "hasPricePerUnitIncrease": False,
                "costPerDish": cost_contrib,
                "costStatus": "available",
                "isPreparation": False,
                "referencePrice": product.current_price,
                "productID": f"prod~{product.id}",
                "childRecipeID": None,
                "suppliers": suppliers_list
            })
        elif ing.child_recipe_id and ing.child_recipe:
            child = ing.child_recipe
            # Cost of child recipe per unit
            child_cost_per_unit = sum(_calculate_ingredient_cost(c_ing, {recipe.id, child.id}) for c_ing in child.ingredients)
            
            linked_articles.append({
                "ingredientID": child.dish_id or f"dish~{child.id}",
                "ingredientLineID": str(ing.id),
                "ingredientType": "preparation",
                "name": child.name,
                "quantity": ing.quantity,
                "displayUnit": child.unit_of_measure or "ud",
                "shrinkage": 0.0,
                "shrinkageType": "absolute",
                "netQuantity": ing.quantity,
                "lastPrice": child_cost_per_unit,
                "hasPricePerUnitIncrease": False,
                "costPerDish": cost_contrib,
                "costStatus": "available",
                "isPreparation": True,
                "referencePrice": child_cost_per_unit,
                "productID": None,
                "childRecipeID": child.dish_id or f"dish~{child.id}",
                "suppliers": []
            })

    base_price = recipe.base_price or (recipe.sale_price / 1.10 if recipe.sale_price > 0.0 else 0.0)
    tax_val = recipe.tax_amount or (recipe.sale_price - base_price)
    
    profit = base_price - total_cost
    margin = (profit / base_price) if base_price > 0.0 else 0.0
    
    # hasErrors if cost percentage exceeds target cost percentage
    cost_pct = (total_cost / base_price * 100) if base_price > 0.0 else 0.0
    has_errors = cost_pct > recipe.target_cost_percentage

    tag_obj = None
    if recipe.tag_name:
        tag_obj = {
            "id": recipe.tag_id or f"dtag~{recipe.tag_name.lower().replace(' ', '_')}",
            "name": recipe.tag_name
        }

    return {
        "id": recipe.dish_id or f"dish~{recipe.id}",
        "dbId": recipe.id,
        "name": recipe.name,
        "base": base_price,
        "tax": tax_val,
        "price": base_price + tax_val,
        "cost": total_cost,
        "profit": profit,
        "margin": margin,
        "hasErrors": has_errors,
        "isPreparation": recipe.is_preparation,
        "unitOfMeasure": recipe.unit_of_measure,
        "portions": 1,
        "usesInMenus": 0,
        "tag": tag_obj,
        "notes": recipe.notes,
        "imageUrl": recipe.image_url,
        "linkedArticles": linked_articles
    }

def get_recipe_bom(db: Session, recipe_id: Any, restaurant_id: int) -> Dict[str, Any]:
    """
    Returns the Bill of Materials for a given recipe/dish ID.
    (recipe_id can be integer or string 'dish~X').
    """
    try:
        recipe_int_id = int(recipe_id)
        statement = select(Recipe).where(Recipe.id == recipe_int_id, Recipe.restaurant_id == restaurant_id)
    except ValueError:
        # It's a string slug (like 'dish~almendras_ape'), lookup by dish_id
        statement = select(Recipe).where(Recipe.dish_id == recipe_id, Recipe.restaurant_id == restaurant_id)
        
    recipe = db.exec(statement).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Recipe with ID {recipe_id} not found")
    
    enriched = enrich_recipe_data(recipe)
    return {
        "bom": {
            "dishID": enriched["id"],
            "cost": enriched["cost"],
            "costStatus": "available",
            "profit": enriched["profit"],
            "margin": enriched["margin"],
            "quantity": 1,
            "uom": enriched["unitOfMeasure"],
            "items": enriched["linkedArticles"],
            "errors": []
        }
    }

def search_supplied_products(db: Session, restaurant_id: int, query: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns a simplified list of supplied products, optionally filtered by name."""
    statement = select(SuppliedProduct).join(Supplier).where(Supplier.restaurant_id == restaurant_id, SuppliedProduct.deleted_at == None)
    if query:
        statement = statement.where(SuppliedProduct.name.ilike(f"%{query}%"))
    statement = statement.limit(100)
    products = db.exec(statement).all()
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "sku": p.sku or "N/A",
            "price": p.current_price,
            "unit": p.unit or "units",
            "supplierName": p.supplier.name if p.supplier else "Unknown"
        }
        for p in products
    ]
def import_recipes_from_parsed_data(db: Session, parsed_recipes: List[Dict[str, Any]], restaurant_id: int) -> List[Recipe]:
    """
    Imports/updates recipes from parsed data using a two-pass import strategy:
    Pass 1: Creates/updates all Recipe records in the database.
    Pass 2: Links ingredients (resolving prep vs raw products).
    """
    imported_recipes = []
    recipe_map = {} # Maps recipe name (lowercased) -> Recipe instance
    
    # ─── PASS 1: Create or Update Recipe Cards ───
    for pr in parsed_recipes:
        name = pr["name"]
        
        # Check if recipe already exists in DB by name
        stmt = select(Recipe).where(Recipe.name.ilike(name), Recipe.restaurant_id == restaurant_id)
        db_recipe = db.exec(stmt).first()
        
        if not db_recipe:
            db_recipe = Recipe(
                restaurant_id=restaurant_id,
                name=name,
                dish_id=f"dish~{name.lower().replace(' ', '_').replace('/', '_')}",
                is_preparation=pr["isPreparation"],
                unit_of_measure=pr["unitOfMeasure"],
                tag_name=pr["tagName"],
                tag_id=f"dtag~{pr['tagName'].lower().replace(' ', '_')}" if pr["tagName"] else None,
                base_price=0.0,
                tax_amount=0.0
            )
            db.add(db_recipe)
        else:
            # Update metadata
            db_recipe.is_preparation = pr["isPreparation"]
            db_recipe.unit_of_measure = pr["unitOfMeasure"]
            if pr["tagName"]:
                db_recipe.tag_name = pr["tagName"]
                db_recipe.tag_id = f"dtag~{pr['tagName'].lower().replace(' ', '_')}"
            db.add(db_recipe)
            
        recipe_map[name.lower()] = db_recipe
        imported_recipes.append(db_recipe)
        
    db.commit()
    for r in imported_recipes:
        db.refresh(r)
        
    # Refresh recipe map with active DB objects (having generated IDs)
    recipe_map = {r.name.lower(): r for r in imported_recipes}

    # Also fetch all other preparations already in DB to resolve links to existing preps
    existing_preps = db.exec(select(Recipe).where(Recipe.is_preparation == True, Recipe.restaurant_id == restaurant_id)).all()
    for ep in existing_preps:
        recipe_map[ep.name.lower()] = ep

    # ─── PASS 2: Clear and populate ingredients ───
    for pr in parsed_recipes:
        db_recipe = recipe_map[pr["name"].lower()]
        
        # Remove existing ingredients for a clean overwrite
        delete_stmt = select(RecipeIngredient).where(RecipeIngredient.recipe_id == db_recipe.id)
        existing_ings = db.exec(delete_stmt).all()
        for ei in existing_ings:
            db.delete(ei)
        db.commit()
        
        for ing in pr["ingredients"]:
            ing_name = ing["name"]
            
            # Check if this ingredient is a sub-recipe (Preparation)
            if ing_name.lower() in recipe_map and recipe_map[ing_name.lower()].is_preparation:
                child_rec = recipe_map[ing_name.lower()]
                db_ing = RecipeIngredient(
                    recipe_id=db_recipe.id,
                    child_recipe_id=child_rec.id,
                    quantity=ing["quantity"]
                )
                db.add(db_ing)
            else:
                # Resolve or create SuppliedProduct
                prod_stmt = select(SuppliedProduct).join(Supplier).where(SuppliedProduct.name.ilike(ing_name), Supplier.restaurant_id == restaurant_id, SuppliedProduct.deleted_at == None)
                prod = db.exec(prod_stmt).first()
                
                if not prod:
                    # Resolve or create Supplier
                    supplier_id = None
                    if ing["supplier"]:
                        supp_stmt = select(Supplier).where(Supplier.name.ilike(ing["supplier"]), Supplier.restaurant_id == restaurant_id)
                        supplier = db.exec(supp_stmt).first()
                        if not supplier:
                            supplier = Supplier(name=ing["supplier"], restaurant_id=restaurant_id)
                            db.add(supplier)
                            db.commit()
                            db.refresh(supplier)
                        supplier_id = supplier.id
                    else:
                        # Fallback default supplier
                        supp_stmt = select(Supplier).where(Supplier.name == "Imported Supplier", Supplier.restaurant_id == restaurant_id)
                        supplier = db.exec(supp_stmt).first()
                        if not supplier:
                            supplier = Supplier(name="Imported Supplier", restaurant_id=restaurant_id)
                            db.add(supplier)
                            db.commit()
                            db.refresh(supplier)
                        supplier_id = supplier.id
                        
                    import uuid
                    prod = SuppliedProduct(
                        name=ing_name,
                        sku=f"IMP-{uuid.uuid4().hex[:8].upper()}",
                        unit=ing["unit"] or "ud",
                        current_price=1.0, # seed price
                        supplier_id=supplier_id
                    )
                    db.add(prod)
                    db.commit()
                    db.refresh(prod)
                    
                db_ing = RecipeIngredient(
                    recipe_id=db_recipe.id,
                    product_id=prod.id,
                    quantity=ing["quantity"]
                )
                db.add(db_ing)
                
    db.commit()
    
    # Reload all recipes to return them fully hydrated
    final_recipes = []
    for pr in parsed_recipes:
        final_recipes.append(db.get(Recipe, recipe_map[pr["name"].lower()].id))
    return final_recipes


def get_recipe_tags(db: Session, restaurant_id: int) -> List[RecipeTagResponse]:
    """Returns all recipe tags."""
    statement = select(RecipeTag).where(RecipeTag.restaurant_id == restaurant_id)
    tags = db.exec(statement).all()
    if not tags:
        seed_default_tags(db)
        tags = db.exec(select(RecipeTag)).all()
    return [
        RecipeTagResponse(
            id=t.tag_id,
            name=t.name,
            isPreparation=t.is_preparation
        )
        for t in tags
    ]

def create_recipe_tag(db: Session, name: str, is_preparation: bool, restaurant_id: int) -> RecipeTagResponse:
    """Creates a new recipe tag."""
    tag_id = f"tag~{name.lower().replace(' ', '_')}"
    statement = select(RecipeTag).where(RecipeTag.tag_id == tag_id, RecipeTag.restaurant_id == restaurant_id)
    existing = db.exec(statement).first()
    
    if existing:
        return RecipeTagResponse(
            id=existing.tag_id,
            name=existing.name,
            isPreparation=existing.is_preparation
        )
        
    new_tag = RecipeTag(
        tag_id=tag_id, 
        name=name, 
        is_preparation=is_preparation,
        restaurant_id=restaurant_id
    )
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    return RecipeTagResponse(
        id=new_tag.tag_id,
        name=new_tag.name,
        isPreparation=new_tag.is_preparation
    )

def delete_recipe_tag(db: Session, tag_id: str, restaurant_id: int) -> None:
    """Deletes a recipe tag by tag_id."""
    statement = select(RecipeTag).where(RecipeTag.tag_id == tag_id, RecipeTag.restaurant_id == restaurant_id)
    tag = db.exec(statement).first()
    if tag:
        db.delete(tag)
        db.commit()

def seed_default_tags(db: Session) -> None:
    """Seeds Haddock default tags and prep categories."""
    default_dishes = [
        "CERVEZAS", "CHUPITO", "cocktail", "CUBATA", "DESTILADO", 
        "Licores", "REFRESCOS", "SNACK APE", "SNACK CARTA", "SPACE", "vino"
    ]
    default_preps = [
        "COCKTAIL", "PREMIX", "PREP COCINA", "SIROPE"
    ]
    
    for name in default_dishes:
        tag_id = f"dtag~{name.lower().replace(' ', '_')}"
        if not db.exec(select(RecipeTag).where(RecipeTag.tag_id == tag_id)).first():
            tag = RecipeTag(tag_id=tag_id, name=name, is_preparation=False)
            db.add(tag)
            
    for name in default_preps:
        tag_id = f"dtag~{name.lower().replace(' ', '_')}"
        if not db.exec(select(RecipeTag).where(RecipeTag.tag_id == tag_id)).first():
            tag = RecipeTag(tag_id=tag_id, name=name, is_preparation=True)
            db.add(tag)
            
    db.commit()

