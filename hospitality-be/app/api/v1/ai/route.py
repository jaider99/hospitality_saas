from fastapi import APIRouter, Depends, status
from sqlmodel import Session
from typing import List

from app.db.session import get_db
from app.module.auth.model import User
from app.module.auth.service import get_current_user
from app.module.ai.schema import ChatRequest, ChatResponse, InsightResponse
from app.module.ai.service import ai_service
from app.core.translation import get_lang

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
def post_chat(
    dto: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang)
):
    """
    Siri-style Chatbot assistant endpoint.
    Retrieves vector documents, live data contexts, and returns a generated answer.
    """
    answer = ai_service.answer_query(db, dto.query, lang=lang)
    return ChatResponse(answer=answer)

@router.get("/insights", response_model=List[InsightResponse])
def list_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang)
):
    """Generates and logs 3 high-impact restaurant recommendations in target language."""
    return ai_service.generate_insights(db, lang=lang)
