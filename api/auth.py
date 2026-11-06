"""Verification of Supabase Auth access tokens.

The browser signs in with Supabase Auth and sends the access token as `Authorization: Bearer ...`.
The token's `sub` is the user id and doubles as the learner id.

A Supabase project signs tokens either with asymmetric JWT signing keys (verified against the
project's JWKS endpoint, needs SUPABASE_URL) or with the legacy shared secret (HS256, needs
SUPABASE_JWT_SECRET). Both are supported; the algorithm comes from the token header and is checked
against an allow-list, so `none` and unexpected algorithms are rejected.
"""
import os
from functools import lru_cache
from urllib.parse import urlsplit
from uuid import UUID

import jwt
from jwt import PyJWKClient

from api.errors import AuthNotConfiguredError, AuthUnavailableError, InvalidTokenError

AUDIENCE = "authenticated"
SHARED_SECRET_ALGORITHMS = ("HS256",)
ASYMMETRIC_ALGORITHMS = ("ES256", "RS256", "EdDSA")


def _supabase_url() -> str | None:
    """The project's base URL. Only scheme and host count: the dashboard also shows /rest/v1/ style addresses.

    SUPABASE_URL wins; VITE_SUPABASE_URL (the value the browser build already needs) is the fallback, so a
    deployment only has to configure the address once.
    """
    parts = urlsplit((os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").strip())
    return f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else None


@lru_cache
def _jwks_client(supabase_url: str) -> PyJWKClient:
    # Supabase caches the key set for 10 minutes at the edge; keep ours shorter so key rotation is picked up.
    return PyJWKClient(f"{supabase_url}/auth/v1/.well-known/jwks.json", cache_keys=True, lifespan=300, timeout=5)


def _signing_key(token: str, algorithm: str, supabase_url: str | None) -> object:
    if algorithm in SHARED_SECRET_ALGORITHMS:
        secret = os.environ.get("SUPABASE_JWT_SECRET", "")
        if not secret:
            raise AuthNotConfiguredError()
        return secret
    if algorithm in ASYMMETRIC_ALGORITHMS:
        if not supabase_url:
            raise AuthNotConfiguredError()
        return _jwks_client(supabase_url).get_signing_key_from_jwt(token).key
    raise InvalidTokenError()


def verify_access_token(token: str) -> UUID:
    """The user id of a valid Supabase access token; raises InvalidTokenError otherwise."""
    supabase_url = _supabase_url()
    try:
        algorithm = jwt.get_unverified_header(token).get("alg", "")
        key = _signing_key(token, algorithm, supabase_url)
        claims = jwt.decode(
            token,
            key,
            algorithms=[algorithm],
            audience=AUDIENCE,
            issuer=f"{supabase_url}/auth/v1" if supabase_url else None,
            options={"require": ["exp", "sub", "aud"]},
        )
        return UUID(claims["sub"])
    except jwt.PyJWKClientConnectionError as exc:
        raise AuthUnavailableError() from exc
    except (jwt.PyJWTError, ValueError) as exc:
        raise InvalidTokenError() from exc
