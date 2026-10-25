from api.db.config import database_url, migration_url, split_url


def test_split_url_strips_libpq_only_options_and_reports_ssl_mode():
    url = "postgres://user:p%40ss@ep-cool-123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    plain, ssl_mode = split_url(url)
    assert plain == "postgresql://user:p%40ss@ep-cool-123-pooler.ap-southeast-1.aws.neon.tech/neondb"
    assert ssl_mode == "require"


def test_split_url_keeps_other_params_and_handles_no_ssl():
    plain, ssl_mode = split_url("postgresql://edtech:pw@db:5432/edtech?application_name=api")
    assert plain == "postgresql://edtech:pw@db:5432/edtech?application_name=api"
    assert ssl_mode is None


def test_runtime_prefers_database_url_then_vercel_postgres_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_URL", "postgres://pooled")
    assert database_url() == "postgres://pooled"
    monkeypatch.setenv("DATABASE_URL", "postgres://explicit")
    assert database_url() == "postgres://explicit"


def test_migrations_use_the_direct_connection_when_the_provider_offers_one(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgres://pooled")
    monkeypatch.delenv("POSTGRES_URL_NON_POOLING", raising=False)
    monkeypatch.delenv("DATABASE_URL_UNPOOLED", raising=False)
    assert migration_url() == "postgres://pooled"
    monkeypatch.setenv("POSTGRES_URL_NON_POOLING", "postgres://direct")
    assert migration_url() == "postgres://direct"
