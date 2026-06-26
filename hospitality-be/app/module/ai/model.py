from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional

class AIInsight(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    content: str
    category: str  # FINANCIAL, INVENTORY, LABOR
    created_at: datetime = Field(default_factory=datetime.utcnow)
