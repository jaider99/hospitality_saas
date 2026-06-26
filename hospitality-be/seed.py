import logging
from datetime import datetime, timedelta
from sqlmodel import Session, SQLModel, select

from app.db.session import engine
from app.module.auth.model import User
from app.module.auth.service import get_password_hash
from app.module.invoices.model import Supplier, SuppliedProduct, ProductCostHistory, Invoice, InvoiceLine
from app.module.recipes.model import Recipe, RecipeIngredient
from app.module.incidents.model import OperationalIncident
from app.module.labor.model import StaffMember, StaffShift
from app.module.ai.model import AIInsight

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

def main():
    logger.info("Dropping existing tables...")
    SQLModel.metadata.drop_all(engine)
    logger.info("Initializing database tables...")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        logger.info("Clearing existing data...")
        # Clear in correct order of foreign key dependencies
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

        # 1. Create Users
        hashed_password = get_password_hash("123456")
        manager = User(
            email="manager@venue.com",
            password=hashed_password,
            name="Venue Manager",
            role="ADMIN"
        )
        session.add(manager)
        session.commit()
        session.refresh(manager)
        logger.info(f"Created User: {manager.email}")

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
