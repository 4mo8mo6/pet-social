from fastapi import HTTPException, status
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.models import (
    Message,
    Pet,
    PetConversation,
    PetDailyQuota,
    PetFriendship,
    PetSocialMessage,
    PetTask,
    PlacedFurniture,
)
from app.schemas import MessageResponse, PetResponse


def build_pet_response(pet: Pet) -> PetResponse:
    return PetResponse(
        id=pet.id,
        petName=pet.pet_name,
        species=pet.species,
        color=pet.color,
        size=pet.size,
        personality=pet.personality,
        specialTraits=pet.special_traits,
        avatarStatus=pet.avatar_status,
        avatarImageUrl=pet.avatar_image_url,
        avatarThumbUrl=pet.avatar_thumb_url,
        avatarVersion=pet.avatar_version,
        avatarError=pet.avatar_error,
        avatarUpdatedAt=pet.avatar_updated_at,
        createdAt=pet.created_at,
        updatedAt=pet.updated_at,
    )


def build_message_response(message: Message) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        pet_id=message.pet_id,
        role=message.role,
        content=message.content,
        created_at=message.created_at,
    )


def get_pet_or_404(db: Session, pet_id: int) -> Pet:
    pet = db.get(Pet, pet_id)

    if pet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 id 为 {pet_id} 的宠物资料。",
        )

    return pet


def get_owned_pet_or_404(db: Session, pet_id: int, user_id: int) -> Pet:
    pet = (
        db.query(Pet)
        .filter(Pet.id == pet_id, Pet.owner_id == user_id)
        .first()
    )

    if pet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 id 为 {pet_id} 的宠物资料。",
        )

    return pet


def delete_pet_with_dependents(db: Session, pet: Pet) -> None:
    pet_id = pet.id
    conversation_ids = select(PetConversation.id).where(
        or_(PetConversation.pet_a_id == pet_id, PetConversation.pet_b_id == pet_id)
    )

    for statement in (
        delete(PetSocialMessage).where(
            or_(
                PetSocialMessage.sender_pet_id == pet_id,
                PetSocialMessage.conversation_id.in_(conversation_ids),
            )
        ),
        delete(PetConversation).where(
            or_(PetConversation.pet_a_id == pet_id, PetConversation.pet_b_id == pet_id)
        ),
        delete(PetFriendship).where(
            or_(
                PetFriendship.pet_a_id == pet_id,
                PetFriendship.pet_b_id == pet_id,
                PetFriendship.initiated_by == pet_id,
            )
        ),
        delete(PetTask).where(
            or_(PetTask.target_pet_id == pet_id, PetTask.source_pet_id == pet_id)
        ),
        delete(PetDailyQuota).where(PetDailyQuota.pet_id == pet_id),
        delete(PlacedFurniture).where(PlacedFurniture.pet_id == pet_id),
        delete(Message).where(Message.pet_id == pet_id),
    ):
        db.execute(statement.execution_options(synchronize_session=False))

    db.delete(pet)
