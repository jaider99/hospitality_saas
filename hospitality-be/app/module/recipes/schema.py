from pydantic import BaseModel, Field
from typing import List, Optional

class RecipeCreate(BaseModel):
    name: str
    dishId: Optional[str] = Field(default=None, alias="dishId")
    isPreparation: Optional[bool] = Field(default=False, alias="isPreparation")
    unitOfMeasure: Optional[str] = Field(default="ud", alias="unitOfMeasure")
    tagId: Optional[str] = Field(default=None, alias="tagId")
    tagName: Optional[str] = Field(default=None, alias="tagName")
    base: Optional[float] = Field(default=0.0, alias="base")
    tax: Optional[float] = Field(default=0.0, alias="tax")
    targetCostPercentage: Optional[float] = Field(default=30.0, alias="targetCostPercentage")
    salePrice: Optional[float] = Field(default=0.0, alias="salePrice")
    notes: Optional[str] = Field(default=None, alias="notes")
    imageUrl: Optional[str] = Field(default=None, alias="imageUrl")

    class Config:
        populate_by_name = True

class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    dishId: Optional[str] = Field(default=None, alias="dishId")
    isPreparation: Optional[bool] = Field(default=None, alias="isPreparation")
    unitOfMeasure: Optional[str] = Field(default=None, alias="unitOfMeasure")
    tagId: Optional[str] = Field(default=None, alias="tagId")
    tagName: Optional[str] = Field(default=None, alias="tagName")
    base: Optional[float] = Field(default=None, alias="base")
    tax: Optional[float] = Field(default=None, alias="tax")
    targetCostPercentage: Optional[float] = Field(default=None, alias="targetCostPercentage")
    salePrice: Optional[float] = Field(default=None, alias="salePrice")
    notes: Optional[str] = Field(default=None, alias="notes")
    imageUrl: Optional[str] = Field(default=None, alias="imageUrl")

    class Config:
        populate_by_name = True

class IngredientAdd(BaseModel):
    productId: Optional[int] = Field(default=None, alias="productId")
    childRecipeId: Optional[int] = Field(default=None, alias="childRecipeId")
    quantity: float

    class Config:
        populate_by_name = True

class SupplierShort(BaseModel):
    id: str
    name: str

class RecipeIngredientResponse(BaseModel):
    ingredientID: str = Field(alias="ingredientID")
    ingredientLineID: str = Field(alias="ingredientLineID")
    ingredientType: str = Field(alias="ingredientType")  # "product" or "preparation"
    name: str
    quantity: float
    displayUnit: str = Field(alias="displayUnit")
    shrinkage: float = 0.0
    shrinkageType: str = Field(default="absolute", alias="shrinkageType")
    netQuantity: float = Field(alias="netQuantity")
    lastPrice: float = Field(alias="lastPrice")
    hasPricePerUnitIncrease: bool = Field(default=False, alias="hasPricePerUnitIncrease")
    costPerDish: float = Field(alias="costPerDish")
    costStatus: str = Field(default="available", alias="costStatus")
    isPreparation: bool = Field(alias="isPreparation")
    referencePrice: float = Field(alias="referencePrice")
    productID: Optional[str] = Field(default=None, alias="productID")
    childRecipeID: Optional[str] = Field(default=None, alias="childRecipeID")
    suppliers: List[SupplierShort] = Field(default_factory=list)

    class Config:
        populate_by_name = True

class DishTag(BaseModel):
    id: str
    name: str

class RecipeResponse(BaseModel):
    id: str
    dbId: int = Field(alias="dbId")
    name: str
    base: float
    tax: float
    price: float
    cost: float
    profit: float
    margin: float
    hasErrors: bool = Field(alias="hasErrors")
    isPreparation: bool = Field(alias="isPreparation")
    unitOfMeasure: str = Field(alias="unitOfMeasure")
    portions: int = 1
    usesInMenus: int = 0
    tag: Optional[DishTag] = None
    notes: Optional[str] = None
    imageUrl: Optional[str] = Field(default=None, alias="imageUrl")
    linkedArticles: List[RecipeIngredientResponse] = Field(default_factory=list, alias="linkedArticles")

    class Config:
        from_attributes = True
        populate_by_name = True
        json_encoders = {
            float: lambda v: round(v, 4)
        }

class BOMDetails(BaseModel):
    dishID: str = Field(alias="dishID")
    cost: float
    costStatus: str = Field(default="available", alias="costStatus")
    profit: float
    margin: float
    quantity: float = 1
    uom: str
    items: List[RecipeIngredientResponse]
    errors: List[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True

class BOMResponse(BaseModel):
    bom: BOMDetails

class UnlinkedDishResponse(BaseModel):
    id: str
    name: str
    tagName: Optional[str] = Field(default=None, alias="tagName")

    class Config:
        populate_by_name = True


class RecipeTagCreate(BaseModel):
    name: str
    isPreparation: bool = Field(alias="isPreparation")

    class Config:
        populate_by_name = True


class RecipeTagResponse(BaseModel):
    id: str
    name: str
    isPreparation: bool = Field(alias="isPreparation")

    class Config:
        from_attributes = True
        populate_by_name = True


