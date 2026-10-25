class QuestionNotFoundError(Exception):
    """Raised when a question id does not exist in the repository."""


class AdminDisabledError(Exception):
    """Raised when admin endpoints are called but no ADMIN_TOKEN is configured."""


class AdminAuthError(Exception):
    """Raised when the admin token is missing or wrong."""


class InvalidAnswerError(Exception):
    """Raised when an answer update references choices the question doesn't have."""


class DatabaseNotConfiguredError(Exception):
    """Raised when a feature needs Postgres but no DATABASE_URL/POSTGRES_URL is set."""


class InvalidLearnerError(Exception):
    """Raised when the X-Learner-Id header is missing or not a UUID."""
