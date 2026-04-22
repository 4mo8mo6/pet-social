"use client";

import {
  HOME_SCENE_OBJECTS,
  type HomeSceneObjectAction,
  type HomeSceneObjectMeta,
} from "../home-scene";
import { cx, ui } from "../ui";

const SCENE_OBJECT_ENTRIES = Object.entries(HOME_SCENE_OBJECTS) as Array<
  [HomeSceneObjectAction, HomeSceneObjectMeta]
>;

function getObjectBadgeClass(kind: HomeSceneObjectMeta["interactionKind"]) {
  return kind === "instant" ? ui.badgeSuccess : ui.badgeNeutral;
}

export function HomeCollapsedTips({ roomLabel }: { roomLabel: string }) {
  return (
    <details className={`${ui.cardMuted} mt-4 px-4 py-3 text-sm leading-6 text-[#7d6858]`}>
      <summary className="cursor-pointer font-semibold text-[#4b382c]">
        今天的小提示
      </summary>
      <div className="mt-3 space-y-3">
        <p>
          现在的小窝在 {roomLabel}。点一点宠物，可以看看它今天怎么样，也可以直接陪它聊聊天。
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SCENE_OBJECT_ENTRIES.map(([action, item]) => (
            <div
              key={action}
              className="rounded-[20px] border border-[#f1e4d2] bg-[#fffdf8] px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-[#4b382c]">{item.label}</p>
                <span className={cx(getObjectBadgeClass(item.interactionKind), "px-2.5 py-1")}>
                  {item.interactionKind === "instant" ? "可以照顾" : "小窝地点"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#8f7b6a]">
                {item.interactionKind === "instant"
                  ? "轻轻点一下，它会马上收到你的照顾。"
                  : "这里会影响它想去哪里休息。"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
