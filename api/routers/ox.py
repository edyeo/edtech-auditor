from typing import Annotated

from fastapi import APIRouter, Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.session import get_optional_session
from api.models.ox import OxCheckRequest, OxCheckResponse, OxExplanationResponse, OxStatementPublic
from api.services.ox_service import OxService

router = APIRouter(prefix="/api/ox", tags=["ox"])
_service = OxService()


@router.get("/statements", response_model=list[OxStatementPublic])
def list_statements() -> list[OxStatementPublic]:
    """Every statement that can be played as O/X, without its verdict."""
    return _service.list_statements()


@router.get("/explanations/{question_id}/{statement_index}", response_model=OxExplanationResponse)
def get_explanation(question_id: str, statement_index: Annotated[int, Path(ge=0)]) -> OxExplanationResponse:
    """Why one statement is true or false (loaded on demand, not with the statement list)."""
    return _service.get_explanation(question_id, statement_index)


@router.post("/check", response_model=OxCheckResponse)
async def check(
    payload: OxCheckRequest, session: Annotated[AsyncSession | None, Depends(get_optional_session)]
) -> OxCheckResponse:
    return await _service.check(
        session, question_id=payload.question_id, statement_index=payload.statement_index, answer=payload.answer
    )
