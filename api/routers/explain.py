from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.session import get_optional_session
from api.errors import QuestionNotFoundError
from api.services.explain_service import ExplainService

router = APIRouter(prefix="/api/explain", tags=["explain"])
_service = ExplainService()


class ExplainRequest(BaseModel):
    question_id: str
    selected_index: int = Field(ge=0)


class ExplainResponse(BaseModel):
    question_id: str
    explanation: str


@router.post("", response_model=ExplainResponse)
async def explain(
    payload: ExplainRequest, session: Annotated[AsyncSession | None, Depends(get_optional_session)]
) -> ExplainResponse:
    try:
        explanation = await _service.explain(
            session, question_id=payload.question_id, selected_index=payload.selected_index
        )
    except QuestionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="question not found") from exc
    return ExplainResponse(question_id=payload.question_id, explanation=explanation)
