import asyncio
import logging
from app.db.session import async_session_maker
from app.module.payroll.model import StaffPosition
from sqlalchemy import select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_positions():
    default_positions = [
        {"name": "Director", "property_id": 1, "color": "blue"},
        {"name": "Waiter/Waitress", "property_id": 1, "color": "purple"},
        {"name": "Cleaning", "property_id": 1, "color": "fuchsia"},
        {"name": "Waiter", "property_id": 1, "color": "purple"},
        {"name": "Chef", "property_id": 1, "color": "orange"},
    ]

    async with async_session_maker() as session:
        for pos_data in default_positions:
            # Check if exists
            result = await session.execute(
                select(StaffPosition).where(
                    StaffPosition.name == pos_data["name"],
                    StaffPosition.property_id == pos_data["property_id"]
                )
            )
            existing = result.scalars().first()
            if not existing:
                logger.info(f"Adding position: {pos_data['name']}")
                new_pos = StaffPosition(**pos_data)
                session.add(new_pos)
            else:
                logger.info(f"Position already exists: {pos_data['name']}")
        
        await session.commit()
        logger.info("Database seeding completed.")

if __name__ == "__main__":
    asyncio.run(seed_positions())
