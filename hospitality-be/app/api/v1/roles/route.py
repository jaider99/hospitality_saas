import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Dict, Any, Union
from pydantic import BaseModel

from app.db.session import get_db
from app.module.auth.model import User, RolePermission
from app.module.auth.service import get_current_user, seed_default_permissions_for_restaurant, ALL_MODULES, DEFAULT_ROLE_PERMISSIONS

router = APIRouter()
logger = logging.getLogger("roles_permissions_router")

class PermissionItem(BaseModel):
    view: str  # None, Own, All
    create: bool
    edit: bool
    delete: bool
    export: bool

class RolePermissionUpdate(BaseModel):
    role_name: str
    module: str
    view: str
    create: bool
    edit: bool
    delete: bool
    export: bool

@router.get("/permissions")
def get_role_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves all role permission configurations for the active restaurant."""
    if not current_user.restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a restaurant to manage role permissions."
        )

    # Only Administrator and SUPER_ADMIN can configure permissions
    if current_user.role not in ["SUPER_ADMIN", "Administrator", "ADMIN"]:
         raise HTTPException(
             status_code=status.HTTP_403_FORBIDDEN,
             detail="Forbidden: Only restaurant owners or administrators can view permissions configuration."
         )

    # Ensure default permissions are seeded
    seed_default_permissions_for_restaurant(db, current_user.restaurant_id)

    # Query all permissions for this restaurant
    stmt = select(RolePermission).where(RolePermission.restaurant_id == current_user.restaurant_id)
    records = db.exec(stmt).all()

    # Group by role_name and module
    grouped: Dict[str, Dict[str, Dict[str, Union[str, bool]]]] = {
        role: {} for role in DEFAULT_ROLE_PERMISSIONS.keys()
    }

    for r in records:
        if r.role_name not in grouped:
            grouped[r.role_name] = {}
        grouped[r.role_name][r.module] = {
            "view": r.view,
            "create": r.create,
            "edit": r.edit,
            "delete": r.delete,
            "export": r.export
        }

    # Fill in any missing modules with defaults
    for role_name in grouped.keys():
        role_defaults = DEFAULT_ROLE_PERMISSIONS.get(role_name, {})
        for m in ALL_MODULES:
            if m not in grouped[role_name]:
                grouped[role_name][m] = role_defaults.get(
                    m,
                    {"view": "None", "create": False, "edit": False, "delete": False, "export": False}
                )

    return grouped

@router.put("/permissions")
def update_role_permissions(
    payload: List[RolePermissionUpdate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates custom role permissions in bulk. Restricted to Restaurant Owner (SUPER_ADMIN) or ADMIN."""
    if not current_user.restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a restaurant to manage role permissions."
        )

    # Only SUPER_ADMIN (Owner) can edit permissions
    if current_user.role != "SUPER_ADMIN":
         raise HTTPException(
             status_code=status.HTTP_403_FORBIDDEN,
             detail="Forbidden: Only the Restaurant Owner (Super Admin) can update permissions configuration."
         )

    # Perform updates/upserts
    for item in payload:
        if item.role_name not in DEFAULT_ROLE_PERMISSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role name '{item.role_name}'. Role must be one of the predefined roles."
            )
        if item.module not in ALL_MODULES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid module name '{item.module}'."
            )
        if item.view not in ["None", "Own", "All"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="View access level must be 'None', 'Own', or 'All'."
            )

        # Look up existing record
        existing = db.exec(
            select(RolePermission).where(
                RolePermission.restaurant_id == current_user.restaurant_id,
                RolePermission.role_name == item.role_name,
                RolePermission.module == item.module
            )
        ).first()

        if existing:
            existing.view = item.view
            existing.create = item.create
            existing.edit = item.edit
            existing.delete = item.delete
            existing.export = item.export
            db.add(existing)
        else:
            rp = RolePermission(
                restaurant_id=current_user.restaurant_id,
                role_name=item.role_name,
                module=item.module,
                view=item.view,
                create=item.create,
                edit=item.edit,
                delete=item.delete,
                export=item.export
            )
            db.add(rp)

    db.commit()
    logger.info(f"Successfully updated {len(payload)} role permissions for restaurant ID {current_user.restaurant_id}")
    return {"status": "success", "message": "Permissions updated successfully."}
