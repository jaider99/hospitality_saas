from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.db.session import get_db
from app.module.auth.model import User
from app.module.restaurant.model import Restaurant
from app.module.restaurant.schema import RestaurantCreate, RestaurantUpdate, RestaurantResponse
from app.core.authz import check_permission
from app.module.auth.service import get_current_user, seed_default_permissions_for_restaurant
from datetime import datetime
from typing import List
from pydantic import BaseModel

router = APIRouter()


@router.get("/all", response_model=List[RestaurantResponse])
def list_all_restaurants(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists restaurants owned by the current SUPER_ADMIN. Restricted to SUPER_ADMIN only."""
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only restaurant owners can list their restaurants."
        )
    # Return restaurants owned by this user
    restaurants = db.exec(select(Restaurant).where(Restaurant.owner_id == current_user.id)).all()
    return restaurants


class SwitchRestaurantPayload(BaseModel):
    restaurant_id: int


@router.patch("/switch", response_model=dict)
def switch_active_restaurant(
    payload: SwitchRestaurantPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Switches the calling SUPER_ADMIN user's active restaurant context within their owned restaurants."""
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only restaurant owners can switch restaurant context."
        )
    restaurant = db.get(Restaurant, payload.restaurant_id)
    if not restaurant or restaurant.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found or you do not have permission to access it."
        )
    current_user.restaurant_id = payload.restaurant_id
    current_user.updated_at = datetime.utcnow()
    db.add(current_user)
    db.commit()
    return {"status": "success", "restaurant_id": payload.restaurant_id, "restaurant_name": restaurant.name}


@router.post("", response_model=RestaurantResponse, status_code=status.HTTP_201_CREATED)
def create_restaurant(
    dto: RestaurantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new restaurant. Restricted to SUPER_ADMIN only."""
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only restaurant owners (SUPER_ADMIN) can create new restaurants."
        )
    restaurant = Restaurant(
        name=dto.name,
        address=dto.address,
        phone=dto.phone,
        email=dto.email,
        tax_id=dto.tax_id,
        currency=dto.currency or "EUR",
        timezone=dto.timezone or "UTC",
        operational_status=dto.operational_status or "OPEN",
        settings_json=dto.settings_json,
        owner_id=current_user.id, # Set current user as the owner
    )
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    # Seed default role permissions for the new restaurant
    seed_default_permissions_for_restaurant(db, restaurant.id)
    return restaurant



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


@router.put("/{restaurant_id}", response_model=RestaurantResponse)
def update_specific_restaurant(
    restaurant_id: int,
    dto: RestaurantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates the details and configuration of a specific restaurant (requires SUPER_ADMIN and ownership)."""
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only restaurant owners can configure specific restaurants."
        )

    restaurant = db.get(Restaurant, restaurant_id)
    if not restaurant or restaurant.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found or you do not have permission to access it."
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
