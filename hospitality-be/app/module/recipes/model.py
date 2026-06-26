from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional, List

class Recipe(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    target_cost_percentage: float = Field(default=30.0, schema_extra={"name": "targetCostPercentage"})
    sale_price: float = Field(default=0.0, schema_extra={"name": "salePrice"})
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    ingredients: List["RecipeIngredient"] = Relationship(
        back_populates="recipe",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

class RecipeIngredient(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    recipe_id: int = Field(foreign_key="recipe.id", ondelete="CASCADE")
    product_id: int = Field(foreign_key="suppliedproduct.id", ondelete="CASCADE")
    quantity: float  # Quantity used in recipe (e.g. 0.150 kg, 0.050 l)

    # Relationships
    recipe: Recipe = Relationship(back_populates="ingredients")
    product: "SuppliedProduct" = Relationship(back_populates="recipe_ingredients")

# Resolve circular dependencies for relationships
from app.module.invoices.model import SuppliedProduct
