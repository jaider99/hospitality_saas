import logging
from typing import Dict, Any, Optional, Union
from supertokens_python import init, InputAppInfo, SupertokensConfig
import supertokens_python.recipe.emailpassword as emailpassword
import supertokens_python.recipe.thirdparty as thirdparty
import supertokens_python.recipe.session as session
import supertokens_python.recipe.userroles as userroles
from supertokens_python.recipe.emailpassword.interfaces import RecipeInterface as EPInterface
from supertokens_python.recipe.thirdparty.interfaces import RecipeInterface as TPInterface
from supertokens_python.recipe.session import SessionContainer
from supertokens_python.recipe.userroles.asyncio import add_role_to_user, create_new_role_or_add_permissions
from app.core.setting import settings

logger = logging.getLogger("supertokens")

def sync_user_to_db(
    supertokens_id: str,
    email: str,
    role: str = "MANAGER",
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    phone: Optional[str] = None,
    restaurant_id: Optional[int] = None,
    restaurant_name: Optional[str] = None
):
    """Synchronizes user registration/login from SuperTokens to PostgreSQL database."""
    from sqlmodel import Session, select
    from app.db.session import engine
    from app.module.auth.model import User
    from app.module.restaurant.model import Restaurant

    try:
        with Session(engine) as db_session:
            resolved_restaurant_id = restaurant_id
            
            # If user has SUPER_ADMIN role and no restaurant_id, create a new Restaurant record
            if role.upper() == "SUPER_ADMIN" and not resolved_restaurant_id:
                res_name = restaurant_name or f"{first_name or ''} {last_name or ''}".strip() or email.split("@")[0]
                if not restaurant_name:
                    res_name = f"{res_name}'s Restaurant"
                
                restaurant = Restaurant(name=res_name)
                db_session.add(restaurant)
                db_session.commit()
                db_session.refresh(restaurant)
                resolved_restaurant_id = restaurant.id
                logger.info(f"Created new Restaurant '{res_name}' with ID: {resolved_restaurant_id}")

            # 1. Look up by supertokens_id
            stmt = select(User).where(User.supertokens_id == supertokens_id)
            user = db_session.exec(stmt).first()

            # 2. Fallback to lookup by email
            if not user:
                stmt_email = select(User).where(User.email == email)
                user = db_session.exec(stmt_email).first()

            if not user:
                logger.info(f"Creating new synchronized user: {email} with ST ID: {supertokens_id}")
                user = User(
                    supertokens_id=supertokens_id,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    name=f"{first_name or ''} {last_name or ''}".strip() or email.split("@")[0],
                    phone=phone,
                    role=role.upper(),
                    restaurant_id=resolved_restaurant_id,
                    status="ACTIVE"
                )
                db_session.add(user)
            else:
                logger.info(f"Updating synchronized user: {email} with ST ID: {supertokens_id}")
                user.supertokens_id = supertokens_id
                user.email = email
                if first_name:
                    user.first_name = first_name
                if last_name:
                    user.last_name = last_name
                if first_name or last_name:
                    user.name = f"{user.first_name or ''} {user.last_name or ''}".strip()
                if phone:
                    user.phone = phone
                if resolved_restaurant_id:
                    user.restaurant_id = resolved_restaurant_id
                db_session.add(user)

            db_session.commit()
            logger.info(f"Successfully synchronized user {email} to PostgreSQL.")
    except Exception as e:
        logger.error(f"Error synchronizing user to PostgreSQL: {e}", exc_info=True)


def override_emailpassword_functions(original_implementation: EPInterface) -> EPInterface:
    original_sign_up = original_implementation.sign_up
    original_sign_in = original_implementation.sign_in

    async def sign_up(
        email: str,
        password: str,
        tenant_id: str,
        session: Optional[SessionContainer],
        should_try_linking_with_session_user: Optional[bool],
        user_context: Dict[str, Any]
    ):
        result = await original_sign_up(
            email=email,
            password=password,
            tenant_id=tenant_id,
            session=session,
            should_try_linking_with_session_user=should_try_linking_with_session_user,
            user_context=user_context
        )

        if hasattr(result, "user") and result.user is not None:
            user_id = result.user.id  # supertokens-python v0.31+: User.id (not .user_id)
            
            # Determine role - check user_context, default to SUPER_ADMIN
            role = "SUPER_ADMIN"
            if user_context and "role" in user_context:
                role_val = user_context.get("role")
                if role_val and role_val.upper() in ["SUPER_ADMIN", "ADMIN", "MANAGER"]:
                    role = role_val.upper()
            try:
                # Assign role in SuperTokens UserRoles recipe
                await add_role_to_user(tenant_id, user_id, role)
            except Exception as role_err:
                logger.error(f"Failed to assign role to user in SuperTokens: {role_err}")

            # Extract optional signup fields from user_context if passed
            first_name = user_context.get("first_name")
            last_name = user_context.get("last_name")
            phone = user_context.get("phone")
            restaurant_name = user_context.get("restaurant_name")
            restaurant_id = user_context.get("restaurant_id")

            # Synchronize to PostgreSQL
            sync_user_to_db(
                supertokens_id=user_id,
                email=email,
                role=role,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                restaurant_id=restaurant_id,
                restaurant_name=restaurant_name
            )
        return result

    async def sign_in(
        email: str,
        password: str,
        tenant_id: str,
        session: Optional[SessionContainer],
        should_try_linking_with_session_user: Optional[bool],
        user_context: Dict[str, Any]
    ):
        from sqlmodel import Session, select
        from app.db.session import engine
        from app.module.auth.model import User

        with Session(engine) as db_session:
            stmt = select(User).where(User.email == email)
            user = db_session.exec(stmt).first()
            if user and user.status == "INACTIVE":
                from supertokens_python.recipe.emailpassword.interfaces import WrongCredentialsError
                logger.warning(f"Sign-in blocked for Inactive user: {email}")
                return WrongCredentialsError()

        return await original_sign_in(
            email=email,
            password=password,
            tenant_id=tenant_id,
            session=session,
            should_try_linking_with_session_user=should_try_linking_with_session_user,
            user_context=user_context
        )

    original_implementation.sign_up = sign_up
    original_implementation.sign_in = sign_in
    return original_implementation


def override_thirdparty_functions(original_implementation: TPInterface) -> TPInterface:
    original_sign_in_up = original_implementation.sign_in_up

    async def sign_in_up(
        third_party_id: str,
        third_party_user_id: str,
        email: str,
        is_verified: bool,
        oauth_tokens: Dict[str, Any],
        raw_user_info_from_provider: Any,
        session: Optional[SessionContainer],
        should_try_linking_with_session_user: Optional[bool],
        tenant_id: str,
        user_context: Dict[str, Any]
    ):
        from sqlmodel import Session, select
        from app.db.session import engine
        from app.module.auth.model import User

        with Session(engine) as db_session:
            stmt = select(User).where(User.email == email)
            user = db_session.exec(stmt).first()
            if user and user.status == "INACTIVE":
                logger.warning(f"ThirdParty sign-in blocked for Inactive user: {email}")
                raise Exception("Account is inactive")

        result = await original_sign_in_up(
            third_party_id=third_party_id,
            third_party_user_id=third_party_user_id,
            email=email,
            is_verified=is_verified,
            oauth_tokens=oauth_tokens,
            raw_user_info_from_provider=raw_user_info_from_provider,
            session=session,
            should_try_linking_with_session_user=should_try_linking_with_session_user,
            tenant_id=tenant_id,
            user_context=user_context
        )

        if hasattr(result, "user") and result.user is not None:
            user_id = result.user.id  # supertokens-python v0.31+: User.id (not .user_id)
            
            if getattr(result, "created_new_user", True):
                role = "SUPER_ADMIN"
                try:
                    await add_role_to_user(tenant_id, user_id, role)
                except Exception as role_err:
                    logger.error(f"Failed to assign role to new ThirdParty user: {role_err}")
            else:
                # Retrieve existing user role if already present
                role = "SUPER_ADMIN"

            # Extract optional signup fields from user_context if passed
            first_name = user_context.get("first_name") if user_context else None
            last_name = user_context.get("last_name") if user_context else None
            phone = user_context.get("phone") if user_context else None
            restaurant_name = user_context.get("restaurant_name") if user_context else None
            restaurant_id = user_context.get("restaurant_id") if user_context else None

            # Sync to PostgreSQL
            sync_user_to_db(
                supertokens_id=user_id,
                email=email,
                role=role,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                restaurant_id=restaurant_id,
                restaurant_name=restaurant_name
            )
        return result

    original_implementation.sign_in_up = sign_in_up
    return original_implementation


def init_supertokens():
    """Initializes self-hosted SuperTokens backend service with required recipes."""
    logger.info("Initializing SuperTokens backend config...")
    
    # Configure API key only if provided
    config_params = {}
    if settings.SUPERTOKENS_API_KEY:
        config_params["api_key"] = settings.SUPERTOKENS_API_KEY

    init(
        app_info=InputAppInfo(
            app_name="Hospitality Elite",
            api_domain=settings.API_DOMAIN,
            website_domain=settings.WEBSITE_DOMAIN,
            api_base_path="/auth",
            website_base_path="/auth",
        ),
        supertokens_config=SupertokensConfig(
            connection_uri=settings.SUPERTOKENS_CONNECTION_URI,
            **config_params
        ),
        framework="fastapi",
        recipe_list=[
            emailpassword.init(
                override=emailpassword.InputOverrideConfig(
                    functions=override_emailpassword_functions
                )
            ),
            thirdparty.init(
                override=thirdparty.InputOverrideConfig(
                    functions=override_thirdparty_functions
                )
            ),
            session.init(),
            userroles.init()
        ]
    )
    logger.info("SuperTokens backend initialization complete.")


async def create_roles_if_not_exist():
    """Creates default roles 'SUPER_ADMIN', 'ADMIN' and 'MANAGER' in SuperTokens core if they do not exist."""
    try:
        # Create MANAGER role
        await create_new_role_or_add_permissions("MANAGER", ["read", "write"])
        # Create ADMIN role
        await create_new_role_or_add_permissions("ADMIN", ["read", "write", "manage"])
        # Create SUPER_ADMIN role
        await create_new_role_or_add_permissions("SUPER_ADMIN", ["read", "write", "manage", "configure_restaurant"])
        logger.info("Successfully configured default roles and permissions in SuperTokens.")
    except Exception as e:
        logger.error(f"Error configuring default roles in SuperTokens: {e}")
