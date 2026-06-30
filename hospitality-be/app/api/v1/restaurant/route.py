from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.db.session import get_db
from app.module.auth.model import User
from app.module.restaurant.model import Restaurant
from app.module.restaurant.schema import RestaurantUpdate, RestaurantResponse
from app.core.authz import check_permission
from datetime import datetime

router = APIRouter()

@router.get("", response_model=RestaurantResponse)
def get_restaurant(
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("read"))
):
    """Retrieves current user's restaurant information."""
    if not current_user.restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not associated with any restaurant."
        )
    restaurant = db.get(Restaurant, current_user.restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found."
        )
    return restaurant

@router.put("", response_model=RestaurantResponse)
def update_restaurant(
    dto: RestaurantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("configure_restaurant"))
):
    """Updates the details and configuration of the restaurant (requires SUPER_ADMIN)."""
    if not current_user.restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not associated with any restaurant."
        )
    restaurant = db.get(Restaurant, current_user.restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found."
        )
        
    # Update fields
    update_data = dto.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(restaurant, key, value)
        
    restaurant.updated_at = datetime.utcnow()
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    return restaurant
