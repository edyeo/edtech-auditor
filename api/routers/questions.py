from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.session import get_optional_session
from api.errors import QuestionNotFoundError
from api.models.question import AnswerCheckRequest, AnswerCheckResponse, QuestionPublic
from api.services.question_service import QuestionService

router = APIRouter(prefix="/api/questions", tags=["questions"])
_service = QuestionService()


@router.get("", response_model=list[QuestionPublic])
def list_questions() -> list[QuestionPublic]:
    return _service.list_questions()


@router.post("/check", response_model=AnswerCheckResponse)
async def check_answer(
    payload: AnswerCheckRequest, session: Annotated[AsyncSession | None, Depends(get_optional_session)]
) -> AnswerCheckResponse:
    try:
        return await _service.check_answer(
            session, question_id=payload.question_id, selected_index=payload.selected_index
        )
    except QuestionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="question not found") from exc
