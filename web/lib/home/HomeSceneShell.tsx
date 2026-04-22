"use client";

import type { ReactNode } from "react";

import {
  HOME_PET_INTERACTION_MENU_ITEMS,
  HOME_SCENE_ROOMS,
  type HomeRoomId,
  type PetInteractionMenuAction,
} from "../home-scene";
import { cx, ui } from "../ui";
import { HomeCollapsedTips } from "./HomeCollapsedTips";

type HomeSceneShellProps = {
  petName: string;
  currentRoom: HomeRoomId;
  statusSummary: string | null;
  isFurnitureEditMode: boolean;
  isFurnitureLayoutSaving: boolean;
  isPetMenuOpen: boolean;
  sceneNode: ReactNode;
  notices?: ReactNode;
  onRoomChange: (room: HomeRoomId) => void;
  onSaveFurniture: () => void;
  onClosePetMenu: () => void;
  onPetMenuAction: (action: PetInteractionMenuAction) => void;
  onOpenFurniture: () => void;
  onOpenChat: () => void;
};

export function HomeSceneShell({
  petName,
  currentRoom,
  statusSummary,
  isFurnitureEditMode,
  isFurnitureLayoutSaving,
  isPetMenuOpen,
  sceneNode,
  notices,
  onRoomChange,
  onSaveFurniture,
  onClosePetMenu,
  onPetMenuAction,
  onOpenFurniture,
  onOpenChat,
}: HomeSceneShellProps) {
  const currentRoomMeta =
    HOME_SCENE_ROOMS.find((room) => room.id === currentRoom) ?? HOME_SCENE_ROOMS[0];

  return (
    <section className={`${ui.cardPrimary} relative overflow-visible p-4 animate-[soft-enter_560ms_ease-out_both] sm:p-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={ui.pageEyebrow}>宠物小窝</p>
          <h2 className={ui.sectionTitle}>{petName} 的小窝</h2>
          <p className="mt-2 text-sm leading-6 text-[#7d6858]">
            先看看它在哪里，再轻轻陪它一下。
          </p>
        </div>
        {statusSummary ? <span className={ui.badgeNeutral}>{statusSummary}</span> : null}
      </div>

      {isFurnitureEditMode ? (
        <div className={`${ui.stickyActionBar} mb-4 flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <p className="text-sm font-semibold">正在布置小窝</p>
            <p className="mt-1 text-xs leading-5 text-[#f8eadc]">
              拖动家具到你喜欢的位置，双击可以旋转。
            </p>
          </div>
          <button
            type="button"
            onClick={onSaveFurniture}
            disabled={isFurnitureLayoutSaving}
            className="rounded-full bg-[#fffdf8] px-4 py-2 text-sm font-semibold text-[#6f4d35] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFurnitureLayoutSaving ? "正在保存..." : "保存小窝"}
          </button>
        </div>
      ) : null}

      <div className={cx("rounded-[28px] border border-[#f0dfc9] bg-[#fffaf3] p-2 transition", isFurnitureEditMode && "ring-4 ring-[#ead0ac]/45")}>
        {sceneNode}
      </div>

      {isPetMenuOpen ? (
        <div className={`${ui.floatingPanel} absolute left-4 top-32 z-30 w-[min(330px,calc(100%-2rem))] animate-[gentle-fade_180ms_ease-out_both]`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#4b382c]">{petName}</p>
              <p className="mt-1 text-xs leading-5 text-[#8f7b6a]">
                它正在等你，想先做什么？
              </p>
            </div>
            <button
              type="button"
              aria-label="关闭宠物操作菜单"
              onClick={onClosePetMenu}
              className={ui.iconButton}
            >
              ×
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {HOME_PET_INTERACTION_MENU_ITEMS.map((item) => (
              <button
                key={item.action}
                type="button"
                onClick={() => onPetMenuAction(item.action)}
                className="rounded-[20px] border border-[#f1e4d2] bg-[#fffaf3] px-3 py-3 text-left transition hover:bg-white"
              >
                <span className="block text-sm font-semibold text-[#4b382c]">
                  {item.action === "status" ? "看看它今天怎么样" : "陪它聊聊天"}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#8f7b6a]">
                  {item.action === "status"
                    ? "看看状态，顺手照顾一下。"
                    : "和它说点悄悄话。"}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenFurniture}
              disabled={isFurnitureLayoutSaving}
              className="rounded-[20px] border border-[#f1e4d2] bg-[#fffdf8] px-3 py-3 text-left text-sm font-semibold text-[#4b382c] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              布置一下小窝
            </button>
          </div>
        </div>
      ) : null}

      <div className={`${ui.cardMuted} mt-4 p-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {HOME_SCENE_ROOMS.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => onRoomChange(room.id)}
                aria-pressed={room.id === currentRoom}
                className={cx(ui.tab, room.id === currentRoom && ui.tabActive)}
              >
                {room.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={isFurnitureEditMode ? onSaveFurniture : onOpenChat}
            disabled={isFurnitureLayoutSaving}
            className={ui.buttonPrimary}
          >
            {isFurnitureEditMode ? "保存小窝" : `陪 ${petName} 聊聊`}
          </button>
        </div>
      </div>

      <HomeCollapsedTips roomLabel={currentRoomMeta.label} />
      {notices ? <div className="mt-4 space-y-3">{notices}</div> : null}
    </section>
  );
}
