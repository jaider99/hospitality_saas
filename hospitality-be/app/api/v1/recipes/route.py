from fastapi import APIRouter, Depends, status, Response, Query, UploadFile, File
from sqlmodel import Session
from typing import List, Optional

from app.db.session import get_db
from app.db.redis import del_cache
from app.module.auth.model import User
from app.module.auth.service import get_current_user
from app.module.recipes.schema import (
    RecipeCreate,
    RecipeUpdate,
    IngredientAdd,
    RecipeResponse,
    BOMResponse,
    UnlinkedDishResponse,
    RecipeTagCreate,
    RecipeTagResponse
)
from app.module.recipes.service import (
    create_recipe,
    get_recipes,
    get_unlinked_dishes,
    get_recipe_details,
    update_recipe,
    delete_recipe,
    add_ingredient,
    remove_ingredient,
    get_recipe_bom,
    search_supplied_products,
    import_recipes_from_parsed_data,
    get_recipe_tags,
    create_recipe_tag,
    delete_recipe_tag
)
from app.module.recipes.recipe_parser import parse_recipes_from_pdf_bytes

router = APIRouter()

@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def post_recipe(
    dto: RecipeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new recipe card."""
    recipe = create_recipe(db, dto)
    # Invalidate list cache
    del_cache("recipes_list")
    return get_recipe_details(db, recipe.id)

@router.get("", response_model=List[RecipeResponse])
def list_recipes(
    preparations: Optional[bool] = Query(default=None, description="Filter by preparations vs saleable dishes"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists recipes/dishes with costing summaries."""
    return get_recipes(db, is_preparation=preparations)

@router.get("/dishes", response_model=List[RecipeResponse])
def list_dishes(
    preparations: bool = Query(default=False, description="Filter for saleable dishes (preparations=false) or preparations"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Haddock-style endpoint for dishes listing."""
    return get_recipes(db, is_preparation=preparations)

@router.get("/dishes/unlinked", response_model=List[UnlinkedDishResponse])
def list_unlinked(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists POS dishes that have no ingredients linked yet."""
    return get_unlinked_dishes(db)

@router.get("/{recipe_id}/bom", response_model=BOMResponse)
def get_bom(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Gets detailed recipe costing bill of materials."""
    return get_recipe_bom(db, recipe_id)

@router.get("/dishes/{recipe_id}/bom", response_model=BOMResponse)
def get_dish_bom(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Haddock-style endpoint to get dish BOM details."""
    return get_recipe_bom(db, recipe_id)

@router.get("/supplied-products", response_model=List[dict])
def list_supplied_products(
    q: Optional[str] = Query(default=None, description="Search term for product description"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Searches SuppliedProduct records to add as recipe ingredients."""
    return search_supplied_products(db, q)

@router.get("/tags", response_model=List[RecipeTagResponse])
def get_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all custom and default recipe tags."""
    return get_recipe_tags(db)

@router.post("/tags", response_model=RecipeTagResponse, status_code=status.HTTP_201_CREATED)
def post_tag(
    dto: RecipeTagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new custom recipe tag."""
    return create_recipe_tag(db, name=dto.name, is_preparation=dto.isPreparation)

@router.delete("/tags/{tag_id}")
def delete_tag(
    tag_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a recipe tag."""
    delete_recipe_tag(db, tag_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Gets detailed recipe costing analysis by local integer ID."""
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
    # Invalidate cache
    del_cache("recipes_list")
    del_cache(f"recipe_{recipe_id}")
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
    """Appends an ingredient portion (supplied product or sub-recipe) to recipe card."""
    add_ingredient(db, recipe_id, dto)
    # Invalidate cache
    del_cache("recipes_list")
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



@router.post("/generate-from-file", response_model=List[RecipeResponse])
def generate_from_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Parses Haddock recipe PDF and imports recipes/preparations."""
    pdf_bytes = file.file.read()
    parsed_recipes = parse_recipes_from_pdf_bytes(pdf_bytes)
    imported_recipes = import_recipes_from_parsed_data(db, parsed_recipes)
    # Clear list cache
    del_cache("recipes_list")
    return [get_recipe_details(db, r.id) for r in imported_recipes]


@router.post("/{recipe_id}/image", response_model=RecipeResponse)
def upload_recipe_image(
    recipe_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Uploads an image for the recipe to MinIO and updates the DB."""
    file_bytes = file.file.read()
    import uuid
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    object_key = f"recipes/recipe_{recipe_id}_{uuid.uuid4().hex[:8]}.{ext}"
    
    from app.core.minio import upload_to_minio
    from app.core.setting import settings
    upload_to_minio(file_bytes, object_key)
    
    minio_url = f"{settings.MINIO_ENDPOINT_URL}/{settings.MINIO_BUCKET_NAME}/{object_key}"
    
    # Invalidate cache
    del_cache("recipes_list")
    del_cache(f"recipe_{recipe_id}")
    
    recipe = update_recipe(db, recipe_id, RecipeUpdate(imageUrl=minio_url))
    return get_recipe_details(db, recipe.id)


