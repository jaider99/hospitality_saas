from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional, List

class Recipe(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dish_id: Optional[str] = Field(default=None, index=True, unique=True, nullable=True)
    name: str
    is_preparation: bool = Field(default=False, index=True)
    unit_of_measure: str = Field(default="ud")
    tag_id: Optional[str] = Field(default=None, nullable=True)
    tag_name: Optional[str] = Field(default=None, nullable=True)
    base_price: float = Field(default=0.0)
    tax_amount: float = Field(default=0.0)
    target_cost_percentage: float = Field(default=30.0, schema_extra={"name": "targetCostPercentage"})
    sale_price: float = Field(default=0.0, schema_extra={"name": "salePrice"})
    notes: Optional[str] = Field(default=None, nullable=True)
    image_url: Optional[str] = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    ingredients: List["RecipeIngredient"] = Relationship(
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "primaryjoin": "RecipeIngredient.recipe_id==Recipe.id",
            "back_populates": "recipe"
        }
    )

class RecipeIngredient(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    recipe_id: int = Field(foreign_key="recipe.id", ondelete="CASCADE")
    product_id: Optional[int] = Field(default=None, foreign_key="suppliedproduct.id", ondelete="CASCADE", nullable=True)
    child_recipe_id: Optional[int] = Field(default=None, foreign_key="recipe.id", ondelete="CASCADE", nullable=True)
    quantity: float  # Quantity used in recipe (e.g. 0.150 kg, 0.050 l)

    # Relationships
    recipe: Recipe = Relationship(
        sa_relationship_kwargs={
            "primaryjoin": "RecipeIngredient.recipe_id==Recipe.id",
            "back_populates": "ingredients"
        }
    )
    product: Optional["SuppliedProduct"] = Relationship(
        sa_relationship_kwargs={
            "primaryjoin": "RecipeIngredient.product_id==SuppliedProduct.id",
            "back_populates": "recipe_ingredients"
        }
    )
    child_recipe: Optional[Recipe] = Relationship(
        sa_relationship_kwargs={
            "primaryjoin": "RecipeIngredient.child_recipe_id==Recipe.id"
        }
    )

# Resolve circular dependencies for relationships
from app.module.invoices.model import SuppliedProduct


class RecipeTag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tag_id: str = Field(unique=True, index=True)
    name: str
    is_preparation: bool = Field(default=False)


