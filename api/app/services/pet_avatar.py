from __future__ import annotations

import base64
import json
import logging
import mimetypes
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

import httpx
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import Pet

logger = logging.getLogger(__name__)

PET_AVATAR_MEDIA_URL_PREFIX = "/media"
PET_AVATAR_SUBDIR = "pet-avatars"
MAX_AVATAR_ERROR_LENGTH = 500


def is_pet_avatar_generation_enabled() -> bool:
    return get_settings().pet_avatar_generation_enabled


def build_pet_avatar_prompt(pet: Pet) -> str:
    settings = get_settings()
    prompt_parts = [
        "Create a polished, cute full-body pet character illustration for a virtual pet game.",
        "Keep the pet centered with a clean silhouette, soft lighting, and no text, watermark, frame, or props.",
        "Prefer a plain or transparent-looking background so the character can replace an in-game avatar texture.",
        f"Species: {pet.species}.",
        f"Main color: {pet.color}.",
        f"Body size impression: {pet.size}.",
        f"Personality and expression: {pet.personality}.",
    ]

    if pet.special_traits.strip():
        prompt_parts.append(f"Distinctive traits: {pet.special_traits}.")

    prompt_parts.append(
        f"The pet's name is {pet.pet_name}; let the design feel consistent with that identity."
    )

    if settings.pet_avatar_prompt_suffix:
        prompt_parts.append(settings.pet_avatar_prompt_suffix.strip())

    return " ".join(part.strip() for part in prompt_parts if part.strip())


def mark_pet_avatar_pending(pet: Pet) -> None:
    pet.avatar_status = "pending"
    pet.avatar_error = None
    pet.avatar_updated_at = datetime.now(timezone.utc)


def mark_pet_avatar_failed(pet: Pet, error_message: str) -> None:
    pet.avatar_status = "failed"
    pet.avatar_error = error_message.strip()[:MAX_AVATAR_ERROR_LENGTH]
    pet.avatar_updated_at = datetime.now(timezone.utc)


def generate_pet_avatar_for_pet_id(pet_id: int) -> None:
    db = SessionLocal()
    try:
        pet = db.get(Pet, pet_id)
        if pet is None:
            return

        if not is_pet_avatar_generation_enabled():
            mark_pet_avatar_failed(
                pet,
                "Pet avatar generation is not configured on the server.",
            )
            db.add(pet)
            db.commit()
            return

        image_bytes, file_suffix = request_pet_avatar_image_bytes(pet)
        persist_generated_pet_avatar(db, pet, image_bytes, file_suffix)
    except Exception as error:  # noqa: BLE001
        logger.exception("Pet avatar generation failed for pet %s", pet_id)
        db.rollback()

        pet = db.get(Pet, pet_id)
        if pet is None:
            return

        mark_pet_avatar_failed(pet, str(error) or "Pet avatar generation failed.")
        try:
            db.add(pet)
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            logger.exception(
                "Failed to persist avatar failure state for pet %s",
                pet_id,
            )
    finally:
        db.close()


def request_pet_avatar_image_bytes(pet: Pet) -> tuple[bytes, str]:
    settings = get_settings()
    if not settings.pet_avatar_generation_url:
        raise RuntimeError("Pet avatar generation URL is not configured.")

    headers = {
        "Accept": "application/json, image/*",
        "Content-Type": "application/json",
    }
    if settings.pet_avatar_api_key:
        headers["Authorization"] = f"Bearer {settings.pet_avatar_api_key}"

    payload: dict[str, object] = {
        "prompt": build_pet_avatar_prompt(pet),
    }
    if settings.pet_avatar_model:
        payload["model"] = settings.pet_avatar_model
    if settings.pet_avatar_image_size:
        payload["size"] = settings.pet_avatar_image_size
    if settings.pet_avatar_image_quality:
        payload["quality"] = settings.pet_avatar_image_quality
    if settings.pet_avatar_background:
        payload["background"] = settings.pet_avatar_background

    try:
        response = httpx.post(
            settings.pet_avatar_generation_url,
            headers=headers,
            json=payload,
            timeout=settings.pet_avatar_timeout_seconds,
        )
    except httpx.HTTPError as error:
        raise RuntimeError("Avatar provider request failed.") from error

    if response.status_code >= 400:
        raise RuntimeError(_build_provider_error_message(response))

    response_content_type = response.headers.get("content-type", "")
    if response_content_type.lower().startswith("image/"):
        return response.content, _guess_image_suffix(response_content_type)

    try:
        response_payload = _load_json_response(response)
    except ValueError as error:
        raise RuntimeError("Avatar provider returned invalid JSON.") from error

    return extract_image_bytes_from_payload(response_payload)


def extract_image_bytes_from_payload(payload: object) -> tuple[bytes, str]:
    for candidate in _iter_image_candidates(payload):
        if isinstance(candidate, str):
            stripped_candidate = candidate.strip()
            if not stripped_candidate:
                continue

            if stripped_candidate.startswith("data:image/"):
                return _decode_data_uri_image(stripped_candidate)

            if stripped_candidate.startswith(("http://", "https://")):
                return _download_generated_image(stripped_candidate)

        if not isinstance(candidate, dict):
            continue

        for base64_key in ("b64_json", "b64", "base64", "image_base64"):
            base64_value = candidate.get(base64_key)
            if isinstance(base64_value, str) and base64_value.strip():
                try:
                    return base64.b64decode(base64_value), ".png"
                except ValueError as error:
                    raise RuntimeError(
                        "Avatar provider returned invalid image data."
                    ) from error

        for url_key in ("url", "image_url", "imageUrl", "output_url"):
            image_url = candidate.get(url_key)
            if isinstance(image_url, str) and image_url.strip():
                return _download_generated_image(image_url.strip())

    raise RuntimeError("Avatar provider response did not contain an image.")


def persist_generated_pet_avatar(
    db: Session,
    pet: Pet,
    image_bytes: bytes,
    file_suffix: str,
) -> None:
    settings = get_settings()
    media_root = Path(settings.pet_avatar_media_root).resolve()
    avatar_dir = media_root / PET_AVATAR_SUBDIR
    avatar_dir.mkdir(parents=True, exist_ok=True)

    previous_paths = {
        path
        for path in (
            _resolve_local_media_path(pet.avatar_image_url, media_root),
            _resolve_local_media_path(pet.avatar_thumb_url, media_root),
        )
        if path is not None
    }

    next_version = (pet.avatar_version or 0) + 1
    safe_suffix = file_suffix if file_suffix.startswith(".") else f".{file_suffix}"
    file_name = f"pet-{pet.id}-avatar-v{next_version}{safe_suffix}"
    file_path = avatar_dir / file_name
    file_path.write_bytes(image_bytes)

    media_url = f"{PET_AVATAR_MEDIA_URL_PREFIX}/{PET_AVATAR_SUBDIR}/{file_name}"

    pet.avatar_status = "ready"
    pet.avatar_image_url = media_url
    pet.avatar_thumb_url = media_url
    pet.avatar_version = next_version
    pet.avatar_error = None
    pet.avatar_updated_at = datetime.now(timezone.utc)

    try:
        db.add(pet)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        if file_path.exists():
            file_path.unlink(missing_ok=True)
        raise RuntimeError("Failed to persist the generated avatar.") from error

    for previous_path in previous_paths:
        if previous_path != file_path and previous_path.exists():
            previous_path.unlink(missing_ok=True)


def _build_provider_error_message(response: httpx.Response) -> str:
    fallback_message = (
        f"Avatar provider request failed with status {response.status_code}."
    )
    try:
        payload = _load_json_response(response)
    except ValueError:
        return fallback_message

    if isinstance(payload, dict):
        error_value = payload.get("error")
        if isinstance(error_value, str) and error_value.strip():
            return error_value.strip()[:MAX_AVATAR_ERROR_LENGTH]
        if isinstance(error_value, dict):
            message = error_value.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()[:MAX_AVATAR_ERROR_LENGTH]
            code = error_value.get("code")
            if isinstance(code, str) and code.strip():
                return code.strip()[:MAX_AVATAR_ERROR_LENGTH]
        detail = payload.get("detail")
        if isinstance(detail, str) and detail.strip():
            return detail.strip()[:MAX_AVATAR_ERROR_LENGTH]
        message = payload.get("message")
        if isinstance(message, str) and message.strip():
            return message.strip()[:MAX_AVATAR_ERROR_LENGTH]
        msg = payload.get("msg")
        if isinstance(msg, str) and msg.strip():
            return msg.strip()[:MAX_AVATAR_ERROR_LENGTH]

    return fallback_message


def _iter_image_candidates(payload: object) -> list[object]:
    candidates: list[object] = []

    def add_candidate(value: object) -> None:
        if isinstance(value, list):
            candidates.extend(value)
        elif value is not None:
            candidates.append(value)

    add_candidate(payload)

    if isinstance(payload, dict):
        add_candidate(payload.get("data"))
        add_candidate(payload.get("images"))
        add_candidate(payload.get("output"))
        add_candidate(payload.get("result"))

    return candidates


def _load_json_response(response: httpx.Response) -> object:
    try:
        return json.loads(response.content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return response.json()


def _decode_data_uri_image(data_uri: str) -> tuple[bytes, str]:
    header, _, encoded = data_uri.partition(",")
    if not encoded:
        raise RuntimeError("Avatar provider returned an invalid data URI.")

    content_type = header.removeprefix("data:").split(";", 1)[0]
    try:
        return base64.b64decode(encoded), _guess_image_suffix(content_type)
    except ValueError as error:
        raise RuntimeError("Avatar provider returned invalid image data.") from error


def _download_generated_image(image_url: str) -> tuple[bytes, str]:
    settings = get_settings()
    try:
        response = httpx.get(
            image_url,
            timeout=settings.pet_avatar_timeout_seconds,
            follow_redirects=True,
        )
    except httpx.HTTPError as error:
        raise RuntimeError("Failed to download the generated avatar image.") from error

    if response.status_code >= 400:
        raise RuntimeError("Failed to download the generated avatar image.")

    content_type = response.headers.get("content-type", "")
    guessed_suffix = _guess_image_suffix(content_type, image_url)
    return response.content, guessed_suffix


def _guess_image_suffix(content_type: str, source_url: str | None = None) -> str:
    normalized_content_type = content_type.split(";", 1)[0].strip().lower()
    guessed_suffix = mimetypes.guess_extension(normalized_content_type) or ""

    if guessed_suffix in {".jpe", ".jpeg"}:
        return ".jpg"
    if guessed_suffix:
        return guessed_suffix

    if source_url:
        parsed_url = urlparse(source_url)
        source_suffix = Path(parsed_url.path).suffix.lower()
        if source_suffix in {".png", ".jpg", ".jpeg", ".webp"}:
            return ".jpg" if source_suffix == ".jpeg" else source_suffix

    return ".png"


def _resolve_local_media_path(
    media_url: str | None,
    media_root: Path,
) -> Path | None:
    if not media_url or not media_url.startswith(f"{PET_AVATAR_MEDIA_URL_PREFIX}/"):
        return None

    relative_media_path = PurePosixPath(
        media_url.removeprefix(f"{PET_AVATAR_MEDIA_URL_PREFIX}/")
    )
    candidate_path = (media_root / Path(*relative_media_path.parts)).resolve()

    if media_root != candidate_path and media_root not in candidate_path.parents:
        return None

    return candidate_path
