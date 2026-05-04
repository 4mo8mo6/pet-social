import os
from dataclasses import dataclass
from pathlib import Path

LOCAL_WEB_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)


def _read_optional_env(*names: str) -> str | None:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value

    return None


def _read_int_env(*names: str, default: int) -> int:
    value = _read_optional_env(*names)
    if value is None:
        return default
    return int(value)


def _normalize_database_url(database_url: str) -> str:
    normalized = database_url.strip()

    if normalized.startswith("postgres://"):
        return f"postgresql+psycopg://{normalized.removeprefix('postgres://')}"

    if normalized.startswith("postgresql://"):
        return f"postgresql+psycopg://{normalized.removeprefix('postgresql://')}"

    return normalized


def _read_cors_allowed_origins(environment: str) -> tuple[str, ...]:
    raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()

    if raw_origins:
        unique_origins: list[str] = []
        for origin in raw_origins.split(","):
            normalized_origin = origin.strip()
            if normalized_origin and normalized_origin not in unique_origins:
                unique_origins.append(normalized_origin)

        return tuple(unique_origins)

    if environment.lower() != "production":
        return LOCAL_WEB_ORIGINS

    return ()


@dataclass(frozen=True)
class Settings:
    app_name: str
    environment: str
    api_host: str
    api_port: int
    secondme_api_base_url: str
    secondme_client_id: str | None
    secondme_client_secret: str | None
    secondme_refresh_endpoint: str
    postgres_host: str
    postgres_port: int
    postgres_db: str
    postgres_user: str
    postgres_password: str
    redis_host: str
    redis_port: int
    database_url_override: str | None
    redis_url_override: str | None
    cors_allowed_origins: tuple[str, ...]
    pet_avatar_generation_url: str | None
    pet_avatar_api_key: str | None
    pet_avatar_model: str | None
    pet_avatar_image_size: str | None
    pet_avatar_image_quality: str | None
    pet_avatar_background: str | None
    pet_avatar_timeout_seconds: int
    pet_avatar_media_root: str
    pet_avatar_prompt_suffix: str | None

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override

        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        if self.redis_url_override:
            return self.redis_url_override

        return f"redis://{self.redis_host}:{self.redis_port}/0"

    @property
    def pet_avatar_generation_enabled(self) -> bool:
        return bool(self.pet_avatar_generation_url)


def get_settings() -> Settings:
    environment = os.getenv("APP_ENV", "development").strip() or "development"
    default_media_root = str(Path(__file__).resolve().parent.parent / "media")
    database_url_override = _read_optional_env("DATABASE_URL", "POSTGRES_URL")
    redis_url_override = _read_optional_env(
        "REDIS_URL",
        "REDIS_PRIVATE_URL",
        "REDIS_PUBLIC_URL",
    )

    return Settings(
        app_name=os.getenv("APP_NAME", "Pet Agent Social API"),
        environment=environment,
        api_host=os.getenv("API_HOST", "0.0.0.0"),
        api_port=_read_int_env("API_PORT", "PORT", default=8000),
        secondme_api_base_url=os.getenv(
            "SECONDME_API_BASE_URL", "https://api.mindverse.com/gate/lab"
        ),
        secondme_client_id=os.getenv("SECONDME_CLIENT_ID"),
        secondme_client_secret=os.getenv("SECONDME_CLIENT_SECRET"),
        secondme_refresh_endpoint=os.getenv(
            "SECONDME_REFRESH_ENDPOINT",
            "https://api.mindverse.com/gate/lab/api/oauth/token/refresh",
        ),
        postgres_host=os.getenv("POSTGRES_HOST", "localhost"),
        postgres_port=int(os.getenv("POSTGRES_PORT", "5432")),
        postgres_db=os.getenv("POSTGRES_DB", "pet_agent_social"),
        postgres_user=os.getenv("POSTGRES_USER", "pet_agent"),
        postgres_password=os.getenv("POSTGRES_PASSWORD", "pet_agent_password"),
        redis_host=os.getenv("REDIS_HOST", "localhost"),
        redis_port=int(os.getenv("REDIS_PORT", "6379")),
        database_url_override=(
            _normalize_database_url(database_url_override)
            if database_url_override
            else None
        ),
        redis_url_override=redis_url_override,
        cors_allowed_origins=_read_cors_allowed_origins(environment),
        pet_avatar_generation_url=_read_optional_env(
            "PET_AVATAR_GENERATION_URL",
            "PET_AVATAR_IMAGE_API_URL",
        ),
        pet_avatar_api_key=_read_optional_env(
            "PET_AVATAR_API_KEY",
            "PET_AVATAR_IMAGE_API_KEY",
        ),
        pet_avatar_model=_read_optional_env(
            "PET_AVATAR_MODEL",
            "PET_AVATAR_IMAGE_MODEL",
        ),
        pet_avatar_image_size=_read_optional_env(
            "PET_AVATAR_IMAGE_SIZE",
            "PET_AVATAR_SIZE",
        ),
        pet_avatar_image_quality=_read_optional_env(
            "PET_AVATAR_IMAGE_QUALITY",
            "PET_AVATAR_QUALITY",
        ),
        pet_avatar_background=_read_optional_env(
            "PET_AVATAR_BACKGROUND",
            "PET_AVATAR_IMAGE_BACKGROUND",
        ),
        pet_avatar_timeout_seconds=_read_int_env(
            "PET_AVATAR_TIMEOUT_SECONDS",
            default=60,
        ),
        pet_avatar_media_root=os.getenv(
            "PET_AVATAR_MEDIA_ROOT",
            default_media_root,
        ).strip()
        or default_media_root,
        pet_avatar_prompt_suffix=_read_optional_env("PET_AVATAR_PROMPT_SUFFIX"),
    )
