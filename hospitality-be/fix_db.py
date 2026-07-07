import os
from sqlalchemy import create_engine, text
from app.core.setting import settings
from sqlmodel import SQLModel

import app.module.auth.model
import app.module.invoices.model
import app.module.recipes.model
import app.module.incidents.model
import app.module.labor.model
import app.module.ai.model
import app.module.payroll.model
import app.module.categories.model
import app.module.products.model
from app.ocr.storage import Base as OCRBase

engine = create_engine(settings.DATABASE_URL.split("?")[0])
with engine.begin() as conn:
    conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"))

SQLModel.metadata.create_all(engine)
OCRBase.metadata.create_all(engine)

os.system("python3 -m alembic stamp head")
