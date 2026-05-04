import { useEffect, useState, type CSSProperties } from "react";

import type { PetAvatarInput } from "./pet-avatar";
import { buildPetAvatarAlt, buildPetAvatarDataUri } from "./pet-avatar";
import { resolvePetAvatarImageUrl } from "./pet";

type PetAvatarImagePet = PetAvatarInput & {
  avatarImageUrl?: string | null;
  avatarStatus?: string | null;
};

type PetAvatarImageProps = {
  pet: PetAvatarImagePet;
  className?: string;
  size?: number;
  style?: CSSProperties;
  imageUrl?: string | null;
  avatarStatus?: string | null;
  preferGeneratedImage?: boolean;
};

export function PetAvatarImage({
  pet,
  className,
  size = 240,
  style,
  imageUrl,
  avatarStatus,
  preferGeneratedImage = true,
}: PetAvatarImageProps) {
  const effectiveAvatarStatus = avatarStatus ?? pet.avatarStatus ?? null;
  const resolvedGeneratedImageUrl =
    preferGeneratedImage && effectiveAvatarStatus === "ready"
      ? resolvePetAvatarImageUrl(imageUrl ?? pet.avatarImageUrl)
      : null;
  const fallbackImageUrl = buildPetAvatarDataUri(pet, {
    size,
  });
  const preferredImageUrl = resolvedGeneratedImageUrl ?? fallbackImageUrl;
  const [activeImageUrl, setActiveImageUrl] = useState(preferredImageUrl);

  useEffect(() => {
    setActiveImageUrl(preferredImageUrl);
  }, [preferredImageUrl]);

  return (
    <img
      alt={buildPetAvatarAlt(pet)}
      src={activeImageUrl}
      className={className}
      draggable={false}
      onError={() => {
        if (activeImageUrl !== fallbackImageUrl) {
          setActiveImageUrl(fallbackImageUrl);
        }
      }}
      style={{
        objectFit: "cover",
        ...style,
      }}
    />
  );
}
