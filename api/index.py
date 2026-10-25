from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from sqlalchemy.exc import SQLAlchemyError

from api.errors import (
    AdminAuthError,
    AdminDisabledError,
    DatabaseNotConfiguredError,
    ExplanationUnavailableError,
    InvalidAnswerError,
    InvalidLearnerError,
    QuestionNotFoundError,
)
from api.routers import admin, explain, learner, questions

QUESTION_IMAGES_DIR = Path(__file__).resolve().parent / "data" / "images"

app = FastAPI(title="정보시스템 감리사 기출문제 학습")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO(oma-deferred): restrict to the production frontend origin
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(questions.router)
app.include_router(explain.router)
app.include_router(admin.router)
app.include_router(learner.router)

# Domain errors map to HTTP here so services only raise domain exceptions.
_DOMAIN_ERRORS: dict[type[Exception], tuple[int, str]] = {
    AdminDisabledError: (503, "admin is disabled: ADMIN_TOKEN is not configured"),
    AdminAuthError: (401, "invalid admin token"),
    InvalidAnswerError: (422, "answer references a choice the question does not have"),
    QuestionNotFoundError: (404, "question not found"),
    ExplanationUnavailableError: (502, "explanation provider is unavailable"),
    InvalidLearnerError: (400, "X-Learner-Id header must be a UUID"),
    DatabaseNotConfiguredError: (503, "database is not configured"),
    SQLAlchemyError: (503, "database is unavailable"),
}


def _register_error_handlers() -> None:
    for exc_type, (status_code, detail) in _DOMAIN_ERRORS.items():

        async def handler(_: Request, __: Exception, status_code: int = status_code, detail: str = detail):
            return JSONResponse(status_code=status_code, content={"detail": detail})

        app.add_exception_handler(exc_type, handler)


_register_error_handlers()
app.mount("/api/assets", StaticFiles(directory=QUESTION_IMAGES_DIR), name="assets")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
