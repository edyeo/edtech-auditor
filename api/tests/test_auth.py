import time
import uuid

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from api import auth
from api.errors import AuthNotConfiguredError, AuthUnavailableError, InvalidTokenError
from api.tests.conftest import JWT_SECRET, access_token

SUPABASE_URL = "https://abcdefgh.supabase.co"


def test_a_valid_token_yields_the_user_id():
    user = uuid.uuid4()
    assert auth.verify_access_token(access_token(user)) == user


@pytest.mark.parametrize(
    "token",
    [
        "",
        "not-a-jwt",
        access_token(exp=int(time.time()) - 10),  # expired
        access_token(aud="anon"),  # wrong audience
        access_token(sub="not-a-uuid"),
        access_token(sub=None),  # no subject
        access_token(exp=None),  # never expires
        jwt.encode({"sub": str(uuid.uuid4()), "aud": "authenticated", "exp": int(time.time()) + 60}, "x" * 40, algorithm="HS256"),
    ],
)
def test_bad_tokens_are_rejected(token):
    with pytest.raises(InvalidTokenError):
        auth.verify_access_token(token)


def test_an_unsigned_token_is_rejected():
    forged = jwt.encode({"sub": str(uuid.uuid4()), "aud": "authenticated", "exp": int(time.time()) + 60}, key=None, algorithm="none")
    with pytest.raises(InvalidTokenError):
        auth.verify_access_token(forged)


def test_without_a_configured_secret_verification_is_unavailable(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET")
    with pytest.raises(AuthNotConfiguredError):
        auth.verify_access_token(access_token())


def test_the_issuer_is_checked_when_the_project_url_is_known(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", SUPABASE_URL)
    good = access_token(iss=f"{SUPABASE_URL}/auth/v1")
    assert auth.verify_access_token(good)
    with pytest.raises(InvalidTokenError):
        auth.verify_access_token(access_token(iss="https://evil.example/auth/v1"))
    with pytest.raises(InvalidTokenError):
        auth.verify_access_token(access_token())  # no issuer at all


class _FakeJwks:
    def __init__(self, public_key):
        self._public_key = public_key

    def get_signing_key_from_jwt(self, _token):
        return type("SigningKey", (), {"key": self._public_key})()


def _es256_token(private_key, user: uuid.UUID) -> str:
    claims = {"sub": str(user), "aud": "authenticated", "exp": int(time.time()) + 60, "iss": f"{SUPABASE_URL}/auth/v1"}
    return jwt.encode(claims, private_key, algorithm="ES256", headers={"kid": "k1"})


def test_asymmetric_tokens_are_verified_against_the_project_keys(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", SUPABASE_URL)
    private_key = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setattr(auth, "_jwks_client", lambda _url: _FakeJwks(private_key.public_key()))
    user = uuid.uuid4()
    assert auth.verify_access_token(_es256_token(private_key, user)) == user

    other_key = ec.generate_private_key(ec.SECP256R1())
    with pytest.raises(InvalidTokenError):
        auth.verify_access_token(_es256_token(other_key, user))  # signed by a key the project does not publish


@pytest.mark.parametrize(
    "configured",
    [SUPABASE_URL, f"{SUPABASE_URL}/", f"{SUPABASE_URL}/rest/v1/", f"  {SUPABASE_URL}/auth/v1  "],
)
def test_the_project_url_is_reduced_to_its_origin(monkeypatch, configured):
    monkeypatch.setenv("SUPABASE_URL", configured)
    assert auth._supabase_url() == SUPABASE_URL
    assert auth.verify_access_token(access_token(iss=f"{SUPABASE_URL}/auth/v1"))


def test_the_browser_url_variable_is_used_when_the_server_one_is_missing(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.setenv("VITE_SUPABASE_URL", f"{SUPABASE_URL}/rest/v1/")
    assert auth._supabase_url() == SUPABASE_URL
    monkeypatch.setenv("SUPABASE_URL", "https://other.supabase.co")
    assert auth._supabase_url() == "https://other.supabase.co"  # the server variable wins


def test_a_blank_project_url_means_not_configured(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.delenv("VITE_SUPABASE_URL", raising=False)
    assert auth._supabase_url() is None


def test_asymmetric_tokens_need_the_project_url(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    token = _es256_token(ec.generate_private_key(ec.SECP256R1()), uuid.uuid4())
    with pytest.raises(AuthNotConfiguredError):
        auth.verify_access_token(token)


def test_an_unreachable_key_set_is_a_service_error_not_a_bad_token(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", SUPABASE_URL)

    class _Unreachable:
        def get_signing_key_from_jwt(self, _token):
            raise jwt.PyJWKClientConnectionError("down")

    monkeypatch.setattr(auth, "_jwks_client", lambda _url: _Unreachable())
    token = _es256_token(ec.generate_private_key(ec.SECP256R1()), uuid.uuid4())
    with pytest.raises(AuthUnavailableError):
        auth.verify_access_token(token)


def test_the_test_secret_is_long_enough_for_hs256():
    assert len(JWT_SECRET.encode()) >= 32
