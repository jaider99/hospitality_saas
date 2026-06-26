from pydantic import BaseModel, Field
from typing import List, Optional

class RecipeCreate(BaseModel):
    name: str
    targetCostPercentage: Optional[float] = Field(default=30.0, alias="targetCostPercentage")
    salePrice: Optional[float] = Field(default=0.0, alias="salePrice")

    class Config:
        populate_by_name = True

class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    targetCostPercentage: Optional[float] = Field(default=None, alias="targetCostPercentage")
    salePrice: Optional[float] = Field(default=None, alias="salePrice")

    class Config:
        populate_by_name = True

class IngredientAdd(BaseModel):
    productId: int
    quantity: float

class RecipeIngredientResponse(BaseModel):
    ingredientId: int
    productId: int
    productName: str
    sku: str
    pricePerUnit: float
    unit: str
    quantityUsed: float
    costContribution: float

class RecipeResponse(BaseModel):
    id: int
    name: str
    targetCostPercentage: float
    salePrice: float
    totalPortionCost: float
    profitMargin: float
    actualCostPercentage: float
    isWarning: bool
    ingredients: List[RecipeIngredientResponse]

    class Config:
        from_attributes = True
        populate_by_name = True
        # Allow resolving aliases in serialization
        json_encoders = {
            float: lambda v: round(v, 2)
        }
