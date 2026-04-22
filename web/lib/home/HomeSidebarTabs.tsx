"use client";

import type { ReactNode } from "react";

import { cx, ui } from "../ui";

export type HomeCompanionTab = "status" | "chat" | "furniture";

type HomeSidebarTabsProps = {
  activeTab: HomeCompanionTab;
  roomLabel: string;
  statusPanel: ReactNode;
  chatPanel: ReactNode;
  furniturePanel: ReactNode;
  onTabChange: (tab: HomeCompanionTab) => void;
};

const TABS: Array<{ id: HomeCompanionTab; label: string }> = [
  { id: "status", label: "今日状态" },
  { id: "chat", label: "陪它聊天" },
  { id: "furniture", label: "小窝布置" },
];

export function HomeSidebarTabs({
  activeTab,
  roomLabel,
  statusPanel,
  chatPanel,
  furniturePanel,
  onTabChange,
}: HomeSidebarTabsProps) {
  return (
    <aside className={`${ui.sidebarPanel} flex min-h-[620px] flex-col p-4 animate-[soft-enter_620ms_ease-out_both] sm:p-5 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]`}>
      <div className={ui.panelHeader}>
        <div>
          <p className={ui.pageEyebrow}>陪伴面板</p>
          <h2 className={ui.sectionTitle}>它的小日常</h2>
          <p className="mt-2 text-sm leading-6 text-[#7d6858]">
            现在在 {roomLabel}，可以看看它今天怎么样。
          </p>
        </div>
        <span className={ui.badgeNeutral}>{roomLabel}</span>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={cx(ui.tab, activeTab === tab.id && ui.tabActive)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {activeTab === "status" ? statusPanel : null}
        {activeTab === "chat" ? chatPanel : null}
        {activeTab === "furniture" ? furniturePanel : null}
      </div>
    </aside>
  );
}
