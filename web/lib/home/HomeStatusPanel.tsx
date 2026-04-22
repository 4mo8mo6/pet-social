"use client";

import type { PetStatus } from "../PetStatusPanel";
import { getPetStatusEmptyState, type PetStatusViewState } from "../pet-status-view";
import { cx, ui } from "../ui";

type CareAction = "feed" | "drink" | "play" | "clean";

type HomeStatusPanelProps = {
  status: PetStatus | null;
  statusViewState: PetStatusViewState;
  isActing: boolean;
  onCareAction: (action: CareAction, label: string) => void;
};

const STAT_ITEMS = [
  { key: "fullness" as const, label: "吃饱", icon: "🍲" },
  { key: "hydration" as const, label: "喝水", icon: "💧" },
  { key: "affection" as const, label: "亲密", icon: "♡" },
  { key: "energy" as const, label: "精神", icon: "☀" },
  { key: "cleanliness" as const, label: "干净", icon: "✦" },
];

const CARE_ACTIONS: Array<{ action: CareAction; label: string }> = [
  { action: "feed", label: "喂点吃的" },
  { action: "drink", label: "添一点水" },
  { action: "play", label: "陪它玩会儿" },
  { action: "clean", label: "整理毛毛" },
];

function getStatusMood(status: PetStatus) {
  if (status.hydration < 40) return "它现在有点口渴。";
  if (status.fullness < 40) return "它好像有点饿了。";
  if (status.energy < 30) return "它需要安静休息一下。";
  if (status.affection < 50) return "陪它玩一会儿会更开心。";
  if (status.cleanliness < 35) return "帮它整理一下会更舒服。";
  return "今天状态不错，可以慢慢陪它待一会儿。";
}

function getBarClass(value: number) {
  if (value < 35) return "bg-[#d99b7c]";
  if (value < 65) return "bg-[#d6b071]";
  return "bg-[#8fb37f]";
}

export function HomeStatusPanel({
  status,
  statusViewState,
  isActing,
  onCareAction,
}: HomeStatusPanelProps) {
  if (!status) {
    const emptyState = getPetStatusEmptyState(statusViewState);

    return (
      <div className={ui.emptyState}>
        <p className="font-semibold text-[#4b382c]">{emptyState.title}</p>
        <p className="mt-2">{emptyState.description}</p>
      </div>
    );
  }

  return (
    <div className="animate-[gentle-fade_180ms_ease-out_both] space-y-4">
      <div className={`${ui.cardSecondary} p-4`}>
        <p className={ui.pageEyebrow}>它今天怎么样</p>
        <h3 className="mt-2 text-lg font-semibold text-[#4b382c]">
          {getStatusMood(status)}
        </h3>
      </div>

      <div className="space-y-3">
        {STAT_ITEMS.map((item) => {
          const value = status[item.key];

          return (
            <div
              key={item.key}
              className="rounded-[20px] border border-[#f1e4d2] bg-[#fffdf8] p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-[#4b382c]">
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </span>
                <span className={cx(ui.badgeNeutral, "px-2.5 py-0.5")}>
                  {value}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#f3e5d2]">
                <div
                  className={cx("h-full rounded-full transition-all duration-500", getBarClass(value))}
                  style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {CARE_ACTIONS.map((item) => (
          <button
            key={item.action}
            type="button"
            disabled={isActing}
            onClick={() => onCareAction(item.action, item.label)}
            className={ui.buttonSecondary}
          >
            {isActing ? "稍等一下..." : item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export type { CareAction };
