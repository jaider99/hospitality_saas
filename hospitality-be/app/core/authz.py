from fastapi import Depends, HTTPException, status
from app.module.auth.model import User
from app.module.auth.service import get_current_user
from typing import Set

# Role-to-Permissions Mapping:
# Initially, ADMIN and MANAGER share identical permissions.
# This centralized layout allows adding new roles or restricting existing permissions
# in the future without modifying any route endpoint files.
ROLE_PERMISSIONS = {
    "SUPER_ADMIN": {"read", "write", "manage", "configure_restaurant"},
    "ADMIN": {"read", "write", "manage"},
    "MANAGER": {"read", "write"},
}

def get_user_permissions(user: User) -> Set[str]:
    """Returns the set of permissions associated with the user's role."""
    if not user or not user.role:
        return set()
    return ROLE_PERMISSIONS.get(user.role.upper(), set())

def check_permission(required_permission: str):
    """
    FastAPI dependency to verify if the currently authenticated user
    possesses the specified permission based on their RBAC role.
    """
    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        permissions = get_user_permissions(current_user)
        if required_permission not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Missing required permission '{required_permission}'"
            )
        return current_user
    return dependency
