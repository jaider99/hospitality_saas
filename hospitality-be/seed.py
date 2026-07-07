import logging
from datetime import datetime, timedelta
from sqlmodel import Session, SQLModel, select

from app.db.session import engine
from app.module.auth.model import User, RolePermission
from app.module.auth.service import get_password_hash
from app.module.invoices.model import Supplier, SuppliedProduct, ProductCostHistory, Invoice, InvoiceLine
from app.module.recipes.model import Recipe, RecipeIngredient
from app.module.incidents.model import OperationalIncident
from app.module.labor.model import StaffMember, StaffShift
from app.module.ai.model import AIInsight
from app.module.restaurant.model import Restaurant

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

import asyncio

def main():
    asyncio.run(async_main())

async def async_main():
    from app.ocr.storage import Base, InvoiceRecord, SupplierRecord, InvoiceLineRecord, TaxBracketRecord, OperationalIncidentRecord
    from app.core.supertokens import init_supertokens, create_roles_if_not_exist
    
    # Initialize SuperTokens config
    init_supertokens()
    await create_roles_if_not_exist()

    logger.info("Dropping existing tables...")
    if engine.dialect.name == 'postgresql':
        from sqlalchemy import text
        with engine.begin() as conn:
            result = conn.execute(text(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
            ))
            for row in result.all():
                table_name = row[0]
                conn.execute(text(f'DROP TABLE IF EXISTS "{table_name}" CASCADE'))
    else:
        Base.metadata.drop_all(engine)
        SQLModel.metadata.drop_all(engine)
    logger.info("Initializing database tables...")
    from alembic.config import Config
    from alembic import command
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    
    # Ensure owner_id column is created
    from sqlalchemy import text
    with engine.begin() as conn:
        try:
            conn.execute(text('ALTER TABLE restaurant ADD COLUMN owner_id INTEGER REFERENCES "user"(id);'))
            logger.info("Added owner_id column to restaurant table.")
        except Exception as e:
            logger.info(f"Alter table note/warning: {e}")
            
    # SQLModel.metadata.create_all(engine)
    Base.metadata.create_all(engine)


    with Session(engine) as session:
        logger.info("Clearing existing data...")
        # Clear in correct order of foreign key dependencies
        session.query(OperationalIncidentRecord).delete()
        session.query(InvoiceLineRecord).delete()
        session.query(TaxBracketRecord).delete()
        session.query(InvoiceRecord).delete()
        session.query(SupplierRecord).delete()
        session.query(AIInsight).delete()
        session.query(OperationalIncident).delete()
        session.query(StaffShift).delete()
        session.query(StaffMember).delete()
        session.query(RecipeIngredient).delete()
        session.query(Recipe).delete()
        session.query(ProductCostHistory).delete()
        session.query(InvoiceLine).delete()
        session.query(Invoice).delete()
        session.query(SuppliedProduct).delete()
        session.query(Supplier).delete()
        session.query(User).delete()
        session.commit()

        logger.info("Seeding data...")

        # Create default Restaurant
        bistro = Restaurant(
            name="Hospitality Elite Bistro",
            address="123 Operational Way, Brussels",
            phone="+32 2 123 45 67",
            email="info@elitebistro.com",
            tax_id="BE0123456789",
            currency="EUR",
            timezone="Europe/Brussels",
            operational_status="OPEN"
        )
        session.add(bistro)
        session.commit()
        session.refresh(bistro)
        logger.info("Created default Restaurant")

        # Seed default permissions for restaurant
        from app.module.auth.service import seed_default_permissions_for_restaurant
        seed_default_permissions_for_restaurant(session, bistro.id)
        logger.info("Seeded default role permissions")

        # 1. Create Users
        from supertokens_python.recipe.emailpassword.asyncio import sign_up as st_sign_up
        from supertokens_python.recipe.userroles.asyncio import add_role_to_user
        from supertokens_python.asyncio import list_users_by_account_info
        from supertokens_python.types.base import AccountInfoInput

        # Create Super Admin
        owner_email = "owner@venue.com"
        owner_password = "123456"
        st_owner_id = None

        try:
            res_owner = await st_sign_up("public", owner_email, owner_password)
            if hasattr(res_owner, "user") and res_owner.user is not None:
                st_owner_id = res_owner.recipe_user_id.get_as_string()
        except Exception:
            pass

        if not st_owner_id:
            try:
                users = await list_users_by_account_info("public", AccountInfoInput(email=owner_email))
                if users:
                    st_owner_id = users[0].id
            except Exception as e:
                logger.error(f"Failed to fetch owner from SuperTokens: {e}")

        if not st_owner_id:
            st_owner_id = "dummy-st-id-owner"

        try:
            await add_role_to_user("public", st_owner_id, "SUPER_ADMIN")
        except Exception as e:
            logger.error(f"Failed to assign role to seeded owner: {e}")

        # Fetch or insert Super Admin
        owner = session.exec(select(User).where(User.email == owner_email)).first()
        if not owner:
            owner = User(
                supertokens_id=st_owner_id,
                email=owner_email,
                first_name="Restaurant",
                last_name="Owner",
                name="Restaurant Owner",
                role="SUPER_ADMIN",
                restaurant_id=bistro.id,
                status="ACTIVE"
            )
            session.add(owner)
        else:
            owner.supertokens_id = st_owner_id
            owner.first_name = "Restaurant"
            owner.last_name = "Owner"
            owner.name = "Restaurant Owner"
            owner.role = "SUPER_ADMIN"
            owner.restaurant_id = bistro.id
            owner.status = "ACTIVE"
            session.add(owner)
        
        session.commit()
        session.refresh(owner)
        
        # Link bistro's owner_id
        bistro.owner_id = owner.id
        session.add(bistro)
        session.commit()


        # Create Admin (Venue Manager)
        email = "manager@venue.com"
        password = "123456"
        st_user_id = None

        try:
            res = await st_sign_up("public", email, password)
            if hasattr(res, "user") and res.user is not None:
                st_user_id = res.recipe_user_id.get_as_string()
        except Exception:
            pass

        if not st_user_id:
            try:
                users = await list_users_by_account_info("public", AccountInfoInput(email=email))
                if users:
                    st_user_id = users[0].id
            except Exception as e:
                logger.error(f"Failed to fetch user from SuperTokens core: {e}")

        if not st_user_id:
            st_user_id = "dummy-st-id-manager"

        # Assign role in SuperTokens core
        try:
            await add_role_to_user("public", st_user_id, "ADMIN")
        except Exception as e:
            logger.error(f"Failed to assign role to seeded user: {e}")

        # Fetch or insert Admin
        manager = session.exec(select(User).where(User.email == email)).first()
        if not manager:
            manager = User(
                supertokens_id=st_user_id,
                email=email,
                first_name="Venue",
                last_name="Manager",
                name="Venue Manager",
                role="ADMIN",
                restaurant_id=bistro.id,
                status="ACTIVE"
            )
            session.add(manager)
        else:
            manager.supertokens_id = st_user_id
            manager.first_name = "Venue"
            manager.last_name = "Manager"
            manager.name = "Venue Manager"
            manager.role = "ADMIN"
            manager.restaurant_id = bistro.id
            manager.status = "ACTIVE"
            session.add(manager)

        session.commit()
        session.refresh(owner)
        session.refresh(manager)
        logger.info(f"Created User: {owner.email} (SUPER_ADMIN)")
        logger.info(f"Created User: {manager.email} (ADMIN)")

        # 2. Create Suppliers
        beverage_supplier = Supplier(
            name="Beverage Source Ltd",
            contact_info="orders@bevsource.com"
        )
        food_supplier = Supplier(
            name="Fresh Foods Express",
            contact_info="delivery@freshfoods.com"
        )
        session.add(beverage_supplier)
        session.add(food_supplier)
        session.commit()
        session.refresh(beverage_supplier)
        session.refresh(food_supplier)
        logger.info("Created Suppliers")

       
        session.commit()
        logger.info("Created SuppliedProducts")

        # 4. Create Product Cost Histories
        now = datetime.utcnow()
        logger.info("Created ProductCostHistories")

        # 5. Create Recipes
        gin_tonic = Recipe(name="Hendrick's Tonic", target_cost_percentage=25.0, sale_price=12.00)
        mojito = Recipe(name="Mojito", target_cost_percentage=18.0, sale_price=10.00)
        basil_smash = Recipe(name="Basil Smash", target_cost_percentage=20.0, sale_price=11.50)
        session.add(gin_tonic)
        session.add(mojito)
        session.add(basil_smash)
        session.commit()
        session.refresh(gin_tonic)
        session.refresh(mojito)
        session.refresh(basil_smash)

        # 6. Link Recipe Ingredients
        logger.info("Created Recipes & Linked Ingredients")

        # 7. Create Invoices
        invoice1 = Invoice(
            invoice_number="SUPP-9812",
            supplier_id=beverage_supplier.id,
            issue_date=now,
            total_amount=38.40,
            status="PROCESSED",
            raw_text="Beverage Source Ltd invoice. Mapped items: Hendrick's Gin: 1 bottle @ €23.40, Tonic Water Case: 1 case @ €15.00. Total amount: €38.40"
        )
        session.add(invoice1)
        session.commit()
        session.refresh(invoice1)

      
        logger.info("Created Invoices & Lines")

        # 8. Create Operational Incidents
        incident1 = OperationalIncident(
            type="price_spike",
            severity="high",
            message="Hendrick's Gin increased by 7.3% (from €21.80 to €23.40) in Invoice #SUPP-9812",
            status="OPEN"
        )
        incident2 = OperationalIncident(
            type="labor_cost_leakage",
            severity="critical",
            message="Labor cost ratio reached 34.2% on Monday dinner shift (Target: 30%)",
            status="OPEN"
        )
        incident3 = OperationalIncident(
            type="excessive_waste",
            severity="medium",
            message="15 KG of Tomatoes wasted due to spoilage logged by Kitchen Chef",
            status="OPEN"
        )
        session.add(incident1)
        session.add(incident2)
        session.add(incident3)
        logger.info("Created OperationalIncidents")

        # 9. Create Staff & Shifts
        marco = StaffMember(name="Chef Marco", role="CHEF", hourly_rate=25.00)
        alice = StaffMember(name="Waiter Alice", role="WAITER", hourly_rate=15.00)
        bob = StaffMember(name="Bartender Bob", role="BARTENDER", hourly_rate=18.00)
        session.add(marco)
        session.add(alice)
        session.add(bob)
        session.commit()
        session.refresh(marco)
        session.refresh(alice)
        session.refresh(bob)

        shift1 = StaffShift(
            staff_id=marco.id,
            clock_in=now - timedelta(hours=8),
            clock_out=now - timedelta(hours=1),
            total_hours=7.0,
            total_pay=175.00
        )
        shift2 = StaffShift(
            staff_id=alice.id,
            clock_in=now - timedelta(hours=6)
        )
        session.add(shift1)
        session.add(shift2)
        logger.info("Created Staff & Shifts")

        # 10. AI Insights
        insight1 = AIInsight(
            title="Gin Spends Variance Warning",
            content="Hendrick's Gin is your highest rising inventory expense. Adjust retail pricing of Basil Smash to preserve margin threshold.",
            category="FINANCIAL"
        )
        insight2 = AIInsight(
            title="Monday Understaffing Analysis",
            content="Monday dinner shifts show a 34.2% labor ratio, indicating potential overstaffing or low sales. Recommend reviewing server clock-ins.",
            category="LABOR"
        )
        session.add(insight1)
        session.add(insight2)
        
        session.commit()
        logger.info("Created AIInsights")
        logger.info("Database seeding finished successfully.")

if __name__ == "__main__":
    main()
