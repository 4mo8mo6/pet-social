"use client";

import { useMemo } from "react";

import type { PetStatus } from "../PetStatusPanel";
import { ui } from "../ui";

type HomeHeroProps = {
  petName: string;
  roomLabel: string;
  status: PetStatus | null;
  freshnessText?: string | null;
};

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 11) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function getPetWhisper(status: PetStatus | null, roomLabel: string) {
  if (!status) {
    return "它正在小窝里等你回来。";
  }

  if (status.hydration < 40) {
    return "它好像有点口渴，想喝一点水。";
  }

  if (status.fullness < 40) {
    return "它在小窝里转了转，好像有点饿了。";
  }

  if (status.energy < 30) {
    return "它今天有点困，想在舒服的地方歇一会儿。";
  }

  if (status.affection < 50) {
    return "它好像在等你和它说说话。";
  }

  if (status.cleanliness < 35) {
    return "它刚刚玩了一圈，毛毛需要整理一下。";
  }

  if (status.mood === "happy") {
    return `它今天看起来很开心，正在${roomLabel}慢慢散步。`;
  }

  return `它刚刚在${roomLabel}转了一圈，像是在等你回家。`;
}

export function HomeHero({
  petName,
  roomLabel,
  status,
  freshnessText,
}: HomeHeroProps) {
  const greeting = useMemo(() => getGreeting(), []);
  const whisper = getPetWhisper(status, roomLabel);

  return (
    <section className={`${ui.pageHero} animate-[soft-enter_500ms_ease-out_both]`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className={ui.pageEyebrow}>{greeting}</p>
          <h1 className={ui.pageTitle}>欢迎回家，{petName}</h1>
          <p className={ui.pageLead}>今天它也在小窝里等你。</p>
        </div>

        <div className="rounded-[24px] border border-[#f0dfc9] bg-[#fffaf3] px-4 py-3 text-sm leading-6 text-[#6f5b4c] shadow-[0_14px_40px_-34px_rgba(112,82,55,0.32)]">
          <p className="font-semibold text-[#4b382c]">小窝旁白</p>
          <p className="mt-1">{whisper}</p>
          {freshnessText ? (
            <p className="mt-2 text-xs text-[#9c8775]">{freshnessText}</p>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none mt-5 h-1.5 overflow-hidden rounded-full bg-[#f4e4ce]">
        <div className="h-full w-1/3 rounded-full bg-[#d4ad82] animate-[nest-breathe_4s_ease-in-out_infinite]" />
      </div>
    </section>
  );
}
