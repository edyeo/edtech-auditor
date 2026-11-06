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


class InvalidTokenError(Exception):
    """Raised when the bearer token is missing, malformed, expired or not signed by the Supabase project."""


class AuthNotConfiguredError(Exception):
    """Raised when a token must be verified but SUPABASE_URL / SUPABASE_JWT_SECRET is not set."""


class AuthUnavailableError(Exception):
    """Raised when the key set needed to verify a token could not be fetched from Supabase."""


class ExplanationUnavailableError(Exception):
    """Raised when the LLM provider fails or returns nothing, so no explanation could be produced."""
