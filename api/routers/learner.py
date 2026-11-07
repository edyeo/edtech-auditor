from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.session import get_session
from api.errors import VocabularyImageTooLargeError
from api.models.learner import (
    MAX_IMAGE_BYTES,
    AddVocabularyRequest,
    AttemptRequest,
    AttemptResponse,
    LearnerState,
    LocalImportRequest,
    LocalImportResponse,
    MarkOut,
    MarkRemovedResponse,
    MiniTestRecord,
    MiniTestSubmitRequest,
    MiniTestSubmitResponse,
    ReviewState,
    SetMarkRequest,
    UpdateVocabularyRequest,
    VocabularyImageOut,
    VocabularyTermOut,
)
from api.routers.deps import get_learner_id
from api.services.learner_service import LearnerService


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> LearnerService:
    return LearnerService(session)


LearnerId = Annotated[UUID, Depends(get_learner_id)]
Service = Annotated[LearnerService, Depends(get_service)]

router = APIRouter(prefix="/api/learner", tags=["learner"])


@router.get("/state", response_model=LearnerState)
async def get_state(learner_id: LearnerId, service: Service) -> LearnerState:
    return await service.get_state(learner_id)


@router.get("/mini-tests", response_model=list[MiniTestRecord])
async def list_mini_tests(learner_id: LearnerId, service: Service) -> list[MiniTestRecord]:
    return await service.list_mini_tests(learner_id)


@router.put("/marks/{question_id}", response_model=MarkOut)
async def set_mark(
    question_id: str, payload: SetMarkRequest, learner_id: LearnerId, service: Service
) -> MarkOut:
    """Set how many markers the question carries (1-5); DELETE removes them all."""
    return await service.set_mark_count(learner_id, question_id, payload.count)


@router.delete("/marks/{question_id}", response_model=MarkRemovedResponse)
async def remove_mark(question_id: str, learner_id: LearnerId, service: Service) -> MarkRemovedResponse:
    return await service.remove_mark(learner_id, question_id)


@router.put("/ox-marks/{question_id}/{statement_index}", response_model=MarkOut)
async def set_ox_mark(
    question_id: str,
    statement_index: Annotated[int, Path(ge=0)],
    payload: SetMarkRequest,
    learner_id: LearnerId,
    service: Service,
) -> MarkOut:
    """Set how many markers one O/X statement carries (1-5); DELETE removes them all."""
    return await service.set_ox_mark_count(learner_id, question_id, statement_index, payload.count)


@router.delete("/ox-marks/{question_id}/{statement_index}", status_code=204)
async def remove_ox_mark(
    question_id: str, statement_index: Annotated[int, Path(ge=0)], learner_id: LearnerId, service: Service
) -> None:
    await service.remove_ox_mark(learner_id, question_id, statement_index)


@router.put("/choice-marks/{question_id}/{choice_index}", response_model=MarkOut)
async def set_choice_mark(
    question_id: str,
    choice_index: Annotated[int, Path(ge=0)],
    payload: SetMarkRequest,
    learner_id: LearnerId,
    service: Service,
) -> MarkOut:
    """Set how many markers one answer choice carries (1-5); DELETE removes them all."""
    return await service.set_choice_mark_count(learner_id, question_id, choice_index, payload.count)


@router.delete("/choice-marks/{question_id}/{choice_index}", status_code=204)
async def remove_choice_mark(
    question_id: str, choice_index: Annotated[int, Path(ge=0)], learner_id: LearnerId, service: Service
) -> None:
    await service.remove_choice_mark(learner_id, question_id, choice_index)


@router.post("/vocabulary", response_model=VocabularyTermOut)
async def add_vocabulary_term(
    payload: AddVocabularyRequest, learner_id: LearnerId, service: Service
) -> VocabularyTermOut:
    """Save a word selected in a question; saving one that already exists returns it unchanged."""
    return await service.add_term(learner_id, payload.term, payload.source_question_id, payload.section)


@router.patch("/vocabulary", response_model=VocabularyTermOut)
async def update_vocabulary_term(
    payload: UpdateVocabularyRequest, learner_id: LearnerId, service: Service
) -> VocabularyTermOut:
    """Change the memo and/or the studied flag of a saved word."""
    return await service.update_term(learner_id, payload.term, payload.memo, payload.studied, payload.section)


@router.delete("/vocabulary", status_code=204)
async def remove_vocabulary_term(
    term: Annotated[str, Query(min_length=1, max_length=200)], learner_id: LearnerId, service: Service
) -> None:
    await service.remove_term(learner_id, " ".join(term.split()))


@router.post("/vocabulary/images", response_model=VocabularyImageOut)
async def add_vocabulary_image(
    request: Request,
    term: Annotated[str, Query(min_length=1, max_length=200)],
    learner_id: LearnerId,
    service: Service,
) -> VocabularyImageOut:
    """Attach a picture to a saved word. The body is the raw image; its Content-Type says which format."""
    declared = request.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > MAX_IMAGE_BYTES:
        raise VocabularyImageTooLargeError()  # refuse before reading the body
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    return await service.add_image(learner_id, " ".join(term.split()), content_type, await request.body())


@router.get("/vocabulary/images/{image_id}")
async def get_vocabulary_image(image_id: UUID, learner_id: LearnerId, service: Service) -> Response:
    """The picture's bytes. Needs the bearer token, so the page loads it with fetch rather than an <img> URL."""
    content_type, data = await service.get_image(learner_id, image_id)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/vocabulary/images/{image_id}", status_code=204)
async def remove_vocabulary_image(image_id: UUID, learner_id: LearnerId, service: Service) -> None:
    await service.remove_image(learner_id, image_id)


@router.post("/attempts", response_model=AttemptResponse)
async def record_attempt(attempt: AttemptRequest, learner_id: LearnerId, service: Service) -> AttemptResponse:
    return await service.record_attempt(learner_id, attempt)


@router.put("/review/{question_id}", status_code=204)
async def save_review(question_id: str, state: ReviewState, learner_id: LearnerId, service: Service) -> None:
    await service.save_review(learner_id, question_id, state)


@router.post("/mini-tests", response_model=MiniTestSubmitResponse)
async def submit_mini_test(
    request: MiniTestSubmitRequest, learner_id: LearnerId, service: Service
) -> MiniTestSubmitResponse:
    return await service.submit_mini_test(learner_id, request)


@router.post("/import", response_model=LocalImportResponse)
async def import_local(data: LocalImportRequest, learner_id: LearnerId, service: Service) -> LocalImportResponse:
    return LocalImportResponse(imported=await service.import_local(learner_id, data))
