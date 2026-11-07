from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.session import get_optional_session
from api.models.question import AnswerKeyResponse
from api.services.answer_key_service import AnswerKeyService

router = APIRouter(prefix="/api/answer-key", tags=["answer-key"])
_service = AnswerKeyService()


@router.get("", response_model=AnswerKeyResponse)
async def get_answer_key(
    response: Response, session: Annotated[AsyncSession | None, Depends(get_optional_session)]
) -> AnswerKeyResponse:
    """All correct answers at once. Cached for a minute, so an admin correction reaches the browsers within minutes."""
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return await _service.build(session)
