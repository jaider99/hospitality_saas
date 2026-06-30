from sqlmodel import Session, select
from fastapi import HTTPException, status
from typing import List, Dict, Any

from app.module.recipes.model import Recipe, RecipeIngredient
from app.module.invoices.model import SuppliedProduct
from app.module.recipes.schema import RecipeCreate, RecipeUpdate, IngredientAdd

def create_recipe(db: Session, dto: RecipeCreate) -> Recipe:
    """Creates a new recipe item."""
    recipe = Recipe(
        name=dto.name,
        target_cost_percentage=dto.targetCostPercentage,
        sale_price=dto.salePrice
    )
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe

def add_ingredient(db: Session, recipe_id: int, dto: IngredientAdd) -> RecipeIngredient:
    """Attaches an ingredient (supplied product) with quantity to a recipe."""
    recipe = db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Recipe with ID {recipe_id} not found")
        
    product = db.get(SuppliedProduct, dto.productId)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"SuppliedProduct with ID {dto.productId} not found")
        
    ingredient = RecipeIngredient(
        recipe_id=recipe_id,
        product_id=dto.productId,
        quantity=dto.quantity
    )
    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)
    return ingredient

def get_recipes(db: Session) -> List[Dict[str, Any]]:
    """Lists all recipes enriched with cost analyses and warning thresholds."""
    statement = select(Recipe).order_by(Recipe.name.asc())
    recipes = db.exec(statement).all()
    
    enriched = []
    for recipe in recipes:
        enriched.append(enrich_recipe_data(recipe))
    return enriched

def get_recipe_details(db: Session, recipe_id: int) -> Dict[str, Any]:
    """Retrieves full recipe details enriched with metrics or raises 404."""
    recipe = db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Recipe with ID {recipe_id} not found")
    return enrich_recipe_data(recipe)

def update_recipe(db: Session, recipe_id: int, dto: RecipeUpdate) -> Recipe:
    """Modifies an existing recipe's parameters."""
    recipe = db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Recipe with ID {recipe_id} not found")
        
    if dto.name is not None:
        recipe.name = dto.name
    if dto.targetCostPercentage is not None:
        recipe.target_cost_percentage = dto.targetCostPercentage
    if dto.salePrice is not None:
        recipe.sale_price = dto.salePrice
        
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe

def delete_recipe(db: Session, recipe_id: int) -> Recipe:
    """Removes a recipe from the database with proper transaction management."""
    try:
        recipe = db.get(Recipe, recipe_id)
        if not recipe:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Recipe with ID {recipe_id} not found")
        
        # Delete all ingredients first (cascade delete helper)
        for ingredient in recipe.ingredients:
            db.delete(ingredient)
        
        # Delete the recipe
        db.delete(recipe)
        db.flush()  # Ensure deletes are processed
        db.commit()  # Commit transaction
        
        # Verify deletion
        verification = db.get(Recipe, recipe_id)
        if verification:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Recipe deletion verification failed")
        
        return recipe
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete recipe: {str(e)}")

def remove_ingredient(db: Session, ingredient_id: int) -> RecipeIngredient:
    """Detaches an ingredient from its recipe with proper transaction management."""
    try:
        ingredient = db.get(RecipeIngredient, ingredient_id)
        if not ingredient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"RecipeIngredient with ID {ingredient_id} not found")
        
        db.delete(ingredient)
        db.flush()  # Ensure delete is processed
        db.commit()  # Commit transaction
        
        # Verify deletion
        verification = db.get(RecipeIngredient, ingredient_id)
        if verification:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ingredient deletion verification failed")
        
        return ingredient
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete ingredient: {str(e)}")

def enrich_recipe_data(recipe: Recipe) -> Dict[str, Any]:
    """Helper to calculate total portion cost, profit margin, and warning state for a recipe."""
    total_cost = 0.0
    ingredients_list = []
    
    for ing in recipe.ingredients:
        product = ing.product
        cost_contrib = 0.0
        prod_name = "Unknown Product"
        sku = "N/A"
        price_unit = 0.0
        unit = "units"
        
        if product:
            price_unit = product.current_price
            cost_contrib = price_unit * ing.quantity
            prod_name = product.name
            sku = product.sku
            unit = product.unit
            
        total_cost += cost_contrib
        
        ingredients_list.append({
            "ingredientId": ing.id,
            "productId": ing.product_id,
            "productName": prod_name,
            "sku": sku,
            "pricePerUnit": price_unit,
            "unit": unit,
            "quantityUsed": ing.quantity,
            "costContribution": cost_contrib
        })
        
    sale_price = recipe.sale_price
    cost_percentage = 0.0
    profit_margin = 0.0
    
    if sale_price > 0.0:
        cost_percentage = (total_cost / sale_price) * 100
        profit_margin = sale_price - total_cost
        
    is_warning = cost_percentage > recipe.target_cost_percentage
    
    return {
        "id": recipe.id,
        "name": recipe.name,
        "targetCostPercentage": recipe.target_cost_percentage,
        "salePrice": sale_price,
        "totalPortionCost": total_cost,
        "profitMargin": profit_margin,
        "actualCostPercentage": cost_percentage,
        "isWarning": is_warning,
        "ingredients": ingredients_list
    }
