from fastapi import Depends, HTTPException, status
from sqlmodel import Session
from app.module.auth.model import User
from app.module.auth.service import get_current_user
from app.db.session import get_db
from typing import Optional

def check_permission(module: str, action: Optional[str] = None):
    """
    FastAPI dependency to verify if the currently authenticated user
    possesses the specified permission based on their RBAC role.
    Supports both legacy permissions ("read", "write", etc.) and
    module-specific actions ("documents", "view").
    """
    async def dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        # SUPER_ADMIN bypass
        if current_user.role == "SUPER_ADMIN":
            return current_user

        from app.module.auth.service import get_user_permissions
        perms = get_user_permissions(db, current_user)

        if action is not None:
            # Module-specific action check
            mod_perms = perms.get(module, {})
            if action == "view":
                val = mod_perms.get("view", "None")
                if val == "None":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Forbidden: No view permission for module '{module}'"
                    )
            else:
                if not mod_perms.get(action, False):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Forbidden: Missing permission '{action}' for module '{module}'"
                    )
        else:
            # Legacy permission mapping
            legacy = module
            if legacy == "configure_restaurant":
                if perms.get("restaurant_settings", {}).get("view", "None") == "None":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Forbidden: Missing configure_restaurant permission"
                    )
            elif legacy == "manage":
                sm = perms.get("staff_management", {})
                if not (sm.get("create", False) or sm.get("edit", False) or sm.get("delete", False) or sm.get("view", "None") != "None"):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Forbidden: Missing manage permission"
                    )
            elif legacy == "read":
                has_any_view = any(p.get("view", "None") != "None" for p in perms.values())
                if not has_any_view:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Forbidden: Missing read permission"
                    )
            elif legacy == "write":
                has_any_write = any(
                    p.get("create", False) or p.get("edit", False) or p.get("delete", False)
                    for p in perms.values()
                )
                if not has_any_write:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Forbidden: Missing write permission"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Forbidden: Unknown permission constraint '{legacy}'"
                )

        return current_user
    return dependency
