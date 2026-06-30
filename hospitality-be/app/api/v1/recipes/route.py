from fastapi import APIRouter, Depends, status, Response
from sqlmodel import Session
from typing import List

from app.db.session import get_db
from app.db.redis import del_cache
from app.module.auth.model import User
from app.module.auth.service import get_current_user
from app.module.recipes.schema import RecipeCreate, RecipeUpdate, IngredientAdd, RecipeResponse
from app.module.recipes.service import (
    create_recipe,
    get_recipes,
    get_recipe_details,
    update_recipe,
    delete_recipe,
    add_ingredient,
    remove_ingredient
)

router = APIRouter()

@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def post_recipe(
    dto: RecipeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new recipe card."""
    recipe = create_recipe(db, dto)
    # Return enriched format
    return get_recipe_details(db, recipe.id)

@router.get("", response_model=List[RecipeResponse])
def list_recipes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists recipes with margin summaries."""
    return get_recipes(db)

@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Gets detailed recipe costing analysis."""
    return get_recipe_details(db, recipe_id)

@router.put("/{recipe_id}", response_model=RecipeResponse)
def put_recipe(
    recipe_id: int,
    dto: RecipeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Modifies recipe attributes."""
    recipe = update_recipe(db, recipe_id, dto)
    return get_recipe_details(db, recipe.id)

@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a recipe entirely."""
    delete_recipe(db, recipe_id)
    # Invalidate cache
    del_cache("recipes_list")
    del_cache(f"recipe_{recipe_id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/{recipe_id}/ingredients", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def post_ingredient(
    recipe_id: int,
    dto: IngredientAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Appends an ingredient portion to recipe card."""
    add_ingredient(db, recipe_id, dto)
    # Invalidate cache
    del_cache(f"recipe_{recipe_id}")
    return get_recipe_details(db, recipe_id)

@router.delete("/ingredients/{ingredient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ingredient(
    ingredient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Detaches an ingredient portion from its recipe."""
    remove_ingredient(db, ingredient_id)
    # Invalidate cache for all recipes (ingredient affects multiple recipes)
    del_cache("recipes_list")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
