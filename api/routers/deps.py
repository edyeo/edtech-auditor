"""Request dependencies shared by routers: who is signed in."""
from uuid import UUID

from fastapi import Header

from api.auth import verify_access_token
from api.errors import InvalidTokenError


def get_optional_learner_id(authorization: str | None = Header(default=None)) -> UUID | None:
    """The signed-in user's id, or None when the request carries no `Authorization` header.

    A header that is present but invalid is still an error, so an expired session is never mistaken
    for an anonymous one.
    """
    if authorization is None:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise InvalidTokenError()
    return verify_access_token(token.strip())


def get_learner_id(authorization: str | None = Header(default=None)) -> UUID:
    """The signed-in user's id; the request must carry a valid `Authorization: Bearer ...` header."""
    learner_id = get_optional_learner_id(authorization)
    if learner_id is None:
        raise InvalidTokenError()
    return learner_id
