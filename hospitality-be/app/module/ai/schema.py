from pydantic import BaseModel
from datetime import datetime

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    answer: str

class InsightResponse(BaseModel):
    id: int
    title: str
    content: str
    category: str
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True
