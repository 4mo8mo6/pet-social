import hashlib
import hmac
import json
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import Cookie, Depends, Header, HTTPException, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import AuthSession, User
from app.schemas import UserResponse

PASSWORD_HASH_ITERATIONS = 200_000
AUTH_TOKEN_PREFIX = "Bearer "
AUTH_TOKEN_LENGTH = 32
AUTH_COOKIE_NAME = "pet-agent-social-auth"
AUTH_COOKIE_SECURE_ENV = "AUTH_COOKIE_SECURE"
AUTH_SESSION_TTL = timedelta(days=14)
AUTH_SESSION_ROTATION_INTERVAL = timedelta(minutes=30)
SECONDME_USER_INFO_PATH = "/api/secondme/user/info"
SECONDME_REFRESH_GRANT_TYPE = "refresh_token"
SECONDME_REFRESH_BUFFER = timedelta(minutes=5)
SECONDME_IDENTITY_KEYS = ("userId", "id", "sub", "uid", "openId")
SECONDME_EMAIL_KEYS = ("email", "mail")
SECONDME_NAME_KEYS = ("name", "displayName", "nickname")
SECONDME_AVATAR_KEYS = ("avatar", "avatarUrl", "picture")
SECONDME_BIO_KEYS = ("bio", "description", "intro")
logger = logging.getLogger(__name__)
EMPTY_SECONDME_PROFILE_FINGERPRINT = hashlib.sha256(
    json.dumps(
        {"avatar": None, "bio": None, "name": None},
        ensure_ascii=True,
        sort_keys=True,
    ).encode("utf-8")
).hexdigest()


def build_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        authProvider="secondme" if user.secondme_user_id else "local",
        coins=user.coins,
        created_at=user.created_at,
    )


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_email(email: str) -> str:
    normalized_email = normalize_email(email)

    if (
        not normalized_email
        or "@" not in normalized_email
        or normalized_email.startswith("@")
        or normalized_email.endswith("@")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid email address.",
        )

    local_part, _, domain_part = normalized_email.partition("@")

    if not local_part or not domain_part or "." not in domain_part:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid email address.",
        )

    return normalized_email


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )
    return (
        f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}$"
        f"{salt.hex()}${derived_key.hex()}"
    )


def verify_password(password: str, stored_password_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, expected_hash_hex = (
            stored_password_hash.split("$", 3)
        )
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    try:
        iterations = int(iterations_text)
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False

    calculated_hash_hex = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    ).hex()

    return hmac.compare_digest(calculated_hash_hex, expected_hash_hex)


def build_auth_token() -> str:
    return secrets.token_urlsafe(AUTH_TOKEN_LENGTH)


def build_auth_session_expires_at(now: datetime | None = None) -> datetime:
    return (now or datetime.now(timezone.utc)) + AUTH_SESSION_TTL


def build_auth_session(user_id: int) -> AuthSession:
    now = datetime.now(timezone.utc)
    return AuthSession(
        user_id=user_id,
        token=build_auth_token(),
        expires_at=build_auth_session_expires_at(now),
        last_used_at=now,
    )


def should_use_secure_auth_cookie() -> bool:
    explicit_value = os.getenv(AUTH_COOKIE_SECURE_ENV, "").strip().lower()

    if explicit_value:
        return explicit_value in {"1", "true", "yes", "on"}

    return get_settings().environment.lower() == "production"


def set_auth_cookie(response: Response, token: str, expires_at: datetime) -> None:
    normalized_expires_at = normalize_datetime_to_utc(expires_at)
    now = datetime.now(timezone.utc)
    max_age = max(
        0,
        int(((normalized_expires_at or now) - now).total_seconds()),
    )
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=max_age,
        expires=normalized_expires_at,
        path="/",
        httponly=True,
        secure=should_use_secure_auth_cookie(),
        samesite="lax",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        secure=should_use_secure_auth_cookie(),
        httponly=True,
        samesite="lax",
    )


def read_first_profile_value(
    profile: dict[str, Any], candidate_keys: tuple[str, ...]
) -> str | None:
    for key in candidate_keys:
        value = profile.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return None


def normalize_optional_email(email: str | None) -> str | None:
    if email is None:
        return None

    normalized_email = email.strip().lower()

    if (
        not normalized_email
        or "@" not in normalized_email
        or normalized_email.startswith("@")
        or normalized_email.endswith("@")
    ):
        return None

    local_part, _, domain_part = normalized_email.partition("@")

    if not local_part or not domain_part or "." not in domain_part:
        return None

    return normalized_email


def extract_secondme_email(profile: dict[str, Any]) -> str | None:
    return normalize_optional_email(
        read_first_profile_value(profile, SECONDME_EMAIL_KEYS)
    )


def extract_secondme_user_id(profile: dict[str, Any]) -> str:
    explicit_id = read_first_profile_value(profile, SECONDME_IDENTITY_KEYS)

    if explicit_id is not None:
        return explicit_id

    secondme_email = extract_secondme_email(profile)

    if secondme_email is not None:
        return f"email:{secondme_email}"

    # Fall back to a deterministic profile fingerprint when the upstream
    # profile omits both a stable id and an email address.
    fingerprint_source = json.dumps(
        {
            "name": read_first_profile_value(profile, SECONDME_NAME_KEYS),
            "avatar": read_first_profile_value(profile, SECONDME_AVATAR_KEYS),
            "bio": read_first_profile_value(profile, SECONDME_BIO_KEYS),
        },
        ensure_ascii=True,
        sort_keys=True,
    )
    fingerprint = hashlib.sha256(
        fingerprint_source.encode("utf-8")
    ).hexdigest()

    if fingerprint == EMPTY_SECONDME_PROFILE_FINGERPRINT:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SecondMe user identity is missing from the upstream profile.",
        )

    return f"profile:{fingerprint}"


def build_secondme_placeholder_email(secondme_user_id: str) -> str:
    digest = hashlib.sha256(secondme_user_id.encode("utf-8")).hexdigest()[:24]
    return f"secondme-{digest}@secondme.local"


def build_secondme_token_expires_at(expires_in: int | None):
    if expires_in is None:
        return None

    return datetime.now(timezone.utc) + timedelta(seconds=expires_in)


def normalize_datetime_to_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def parse_optional_positive_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None

    if isinstance(value, int):
        return value if value > 0 else None

    if isinstance(value, str) and value.isdigit():
        parsed_value = int(value)
        return parsed_value if parsed_value > 0 else None

    return None


def should_refresh_secondme_token(user: User) -> bool:
    if user.secondme_user_id is None or not user.secondme_refresh_token:
        return False

    if not user.secondme_access_token:
        return True

    expires_at = normalize_datetime_to_utc(user.secondme_token_expires_at)

    if expires_at is None:
        return False

    return expires_at <= datetime.now(timezone.utc) + SECONDME_REFRESH_BUFFER


def refresh_secondme_tokens(
    refresh_endpoint: str,
    client_id: str,
    client_secret: str,
    refresh_token: str,
) -> dict[str, Any]:
    try:
        response = httpx.post(
            refresh_endpoint,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": SECONDME_REFRESH_GRANT_TYPE,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10.0,
        )
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SecondMe token refresh request failed.",
        ) from error

    try:
        payload = response.json()
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SecondMe token refresh returned invalid JSON.",
        ) from error

    if response.status_code >= 400 or payload.get("code") != 0:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SecondMe token refresh request failed.",
        )

    refresh_data = payload.get("data")

    if not isinstance(refresh_data, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SecondMe token refresh response is missing the token payload.",
        )

    access_token = refresh_data.get("accessToken")

    if not isinstance(access_token, str) or not access_token.strip():
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SecondMe token refresh response is missing the access token.",
        )

    return refresh_data


def ensure_fresh_secondme_access_token(db: Session, user: User) -> User:
    if not should_refresh_secondme_token(user):
        return user

    settings = get_settings()

    if not settings.secondme_client_id or not settings.secondme_client_secret:
        logger.warning(
            "Skipping SecondMe token refresh for user %s because the backend "
            "client credentials are not configured.",
            user.id,
        )
        return user

    try:
        refresh_data = refresh_secondme_tokens(
            settings.secondme_refresh_endpoint,
            settings.secondme_client_id,
            settings.secondme_client_secret,
            user.secondme_refresh_token,
        )
    except HTTPException as error:
        logger.warning(
            "SecondMe token refresh failed for user %s: %s",
            user.id,
            error.detail,
        )
        return user

    refreshed_access_token = refresh_data["accessToken"].strip()
    refreshed_refresh_token = refresh_data.get("refreshToken")
    refreshed_expires_in = parse_optional_positive_int(refresh_data.get("expiresIn"))

    user.secondme_access_token = refreshed_access_token

    if (
        isinstance(refreshed_refresh_token, str)
        and refreshed_refresh_token.strip()
    ):
        user.secondme_refresh_token = refreshed_refresh_token.strip()

    user.secondme_token_expires_at = build_secondme_token_expires_at(
        refreshed_expires_in
    )

    try:
        db.commit()
        db.refresh(user)
    except SQLAlchemyError:
        db.rollback()
        logger.exception(
            "Failed to persist refreshed SecondMe tokens for user %s",
            user.id,
        )

    return user


def fetch_secondme_user_profile(
    secondme_api_base_url: str, access_token: str
) -> dict[str, Any]:
    profile_url = (
        f"{secondme_api_base_url.rstrip('/')}{SECONDME_USER_INFO_PATH}"
    )

    try:
        response = httpx.get(
            profile_url,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SecondMe user info request failed.",
        ) from error

    try:
        payload = response.json()
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SecondMe user info returned invalid JSON.",
        ) from error

    if response.status_code >= 400 or payload.get("code") != 0:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SecondMe user info request failed.",
        )

    profile = payload.get("data")

    if not isinstance(profile, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SecondMe user info response is missing the profile payload.",
        )

    return profile


def read_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None

    if not authorization.startswith(AUTH_TOKEN_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header format is invalid.",
        )

    token = authorization[len(AUTH_TOKEN_PREFIX) :].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token cannot be empty.",
        )

    return token

def read_auth_token(
    authorization: str | None, auth_cookie: str | None
) -> str:
    bearer_token = read_bearer_token(authorization)

    if bearer_token:
        return bearer_token

    cookie_token = (auth_cookie or "").strip()

    if cookie_token:
        return cookie_token

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Please log in before using this endpoint.",
    )


def get_auth_session_or_401(
    db: Session, token: str, response: Response | None = None
) -> AuthSession:
    auth_session = db.query(AuthSession).filter(AuthSession.token == token).first()

    if auth_session is None:
        if response is not None:
            clear_auth_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current login session has expired. Please log in again.",
        )

    now = datetime.now(timezone.utc)
    expires_at = normalize_datetime_to_utc(auth_session.expires_at)

    if expires_at is None or expires_at <= now:
        try:
            db.delete(auth_session)
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            logger.exception("Failed to delete expired auth session %s", auth_session.id)

        if response is not None:
            clear_auth_cookie(response)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current login session has expired. Please log in again.",
        )

    last_used_at = normalize_datetime_to_utc(auth_session.last_used_at)
    should_rotate = (
        last_used_at is None
        or last_used_at <= now - AUTH_SESSION_ROTATION_INTERVAL
    )

    auth_session.last_used_at = now
    auth_session.expires_at = build_auth_session_expires_at(now)

    if should_rotate:
        auth_session.token = build_auth_token()

    try:
        db.commit()
        db.refresh(auth_session)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to refresh auth session %s", auth_session.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Current login session could not be refreshed.",
        )

    if response is not None:
        set_auth_cookie(response, auth_session.token, auth_session.expires_at)

    return auth_session


def get_current_auth_session(
    response: Response,
    authorization: str | None = Header(default=None),
    auth_cookie: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> AuthSession:
    token = read_auth_token(authorization, auth_cookie)
    return get_auth_session_or_401(db, token, response)


def get_current_user(
    auth_session: AuthSession = Depends(get_current_auth_session),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, auth_session.user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current login user no longer exists. Please log in again.",
        )

    return ensure_fresh_secondme_access_token(db, user)
