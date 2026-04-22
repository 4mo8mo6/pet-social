"use client";

import Link from "next/link";

import { ui } from "../ui";

type HomeFurniturePanelProps = {
  isEditMode: boolean;
  isSaving: boolean;
  onToggleEdit: () => void;
};

export function HomeFurniturePanel({
  isEditMode,
  isSaving,
  onToggleEdit,
}: HomeFurniturePanelProps) {
  return (
    <section className="animate-[gentle-fade_180ms_ease-out_both] space-y-4">
      <div className={`${ui.cardSecondary} p-4`}>
        <p className={ui.pageEyebrow}>小窝布置</p>
        <h3 className={ui.sectionTitle}>让它的小窝更舒服一点</h3>
        <p className="mt-2 text-sm leading-6 text-[#7d6858]">
          拖动家具到你喜欢的位置，给它留一个舒服的小角落。
        </p>
      </div>

      <div className={`${ui.cardMuted} p-4`}>
        <p className="text-sm font-semibold text-[#4b382c]">
          {isEditMode ? "现在可以移动家具" : "进入布置后再移动家具"}
        </p>
        <p className="mt-2 text-sm leading-6 text-[#7d6858]">
          双击家具可以旋转，保存后它的小窝会保持新的样子。
        </p>
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={onToggleEdit}
          disabled={isSaving}
          className={ui.buttonPrimary}
        >
          {isSaving
            ? "正在保存..."
            : isEditMode
              ? "保存并回到小窝"
              : "布置一下小窝"}
        </button>
        <Link href="/home/furniture" className={ui.buttonOutline}>
          去家具页慢慢看看
        </Link>
      </div>
    </section>
  );
}
