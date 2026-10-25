import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# libpq-only URL options that asyncpg rejects (Vercel/Neon connection strings carry them).
_LIBPQ_ONLY_PARAMS = {"sslmode", "channel_binding", "options", "target_session_attrs"}


def database_url() -> str | None:
    """Runtime URL. Vercel's Postgres integrations expose DATABASE_URL and/or POSTGRES_URL (pooled)."""
    return os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")


def migration_url() -> str | None:
    """Migrations need a direct (non-pooled) connection when the provider offers one."""
    return (
        os.environ.get("DATABASE_URL_UNPOOLED")
        or os.environ.get("POSTGRES_URL_NON_POOLING")
        or database_url()
    )


def split_url(url: str) -> tuple[str, str | None]:
    """Return (plain postgresql:// URL without libpq-only options, ssl mode or None)."""
    parts = urlsplit(url)
    query = parse_qsl(parts.query, keep_blank_values=True)
    ssl_mode = next((v for k, v in query if k == "sslmode"), None)
    kept = [(k, v) for k, v in query if k not in _LIBPQ_ONLY_PARAMS]
    cleaned = urlunsplit(("postgresql", parts.netloc, parts.path, urlencode(kept), parts.fragment))
    return cleaned, ssl_mode
