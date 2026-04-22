import type { CSSProperties } from "react";

import type { PetAvatarInput } from "./pet-avatar";
import { buildPetAvatarAlt, buildPetAvatarDataUri } from "./pet-avatar";

type PetAvatarImageProps = {
  pet: PetAvatarInput;
  className?: string;
  size?: number;
  style?: CSSProperties;
};

export function PetAvatarImage({
  pet,
  className,
  size = 240,
  style,
}: PetAvatarImageProps) {
  return (
    <div
      role="img"
      aria-label={buildPetAvatarAlt(pet)}
      className={className}
      style={{
        backgroundImage: `url("${buildPetAvatarDataUri(pet, { size })}")`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        ...style,
      }}
    />
  );
}
