from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.session import get_session
from api.models.question import AdminQuestion, AnswerUpdateRequest
from api.services.admin_service import AdminService


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    AdminService.verify_token(x_admin_token)


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> AdminService:
    return AdminService(session)


Service = Annotated[AdminService, Depends(get_service)]

# Auth first (dependency order), so a missing/wrong token never reaches the database.
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/questions", response_model=list[AdminQuestion])
async def list_questions(service: Service) -> list[AdminQuestion]:
    return await service.list_questions()


@router.put("/questions/{question_id}/answer", response_model=AdminQuestion)
async def update_answer(question_id: str, payload: AnswerUpdateRequest, service: Service) -> AdminQuestion:
    return await service.update_answer(question_id, payload.answer_indexes)


@router.delete("/questions/{question_id}/answer", response_model=AdminQuestion)
async def reset_answer(question_id: str, service: Service) -> AdminQuestion:
    return await service.reset_answer(question_id)
