"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { clearStoredAuth, logoutCurrentSession } from "./auth";
import { clearStoredPetId } from "./pet";
import { cx, ui } from "./ui";

const NAV_ITEMS = [
  { href: "/home", label: "主页" },
  { href: "/my-pet", label: "宠物" },
  { href: "/chat", label: "聊天" },
  { href: "/social", label: "社交" },
  { href: "/shop", label: "商店" },
] as const;

const PAGE_LABELS: Array<{ matcher: (pathname: string) => boolean; label: string }> = [
  { matcher: (pathname) => pathname === "/home", label: "宠物小窝" },
  { matcher: (pathname) => pathname.startsWith("/home/furniture"), label: "布置小窝" },
  { matcher: (pathname) => pathname.startsWith("/my-pet"), label: "宠物资料" },
  { matcher: (pathname) => pathname.startsWith("/chat"), label: "陪它聊天" },
  { matcher: (pathname) => pathname.startsWith("/social"), label: "宠物社交" },
  { matcher: (pathname) => pathname.startsWith("/shop"), label: "小窝商店" },
  { matcher: (pathname) => pathname.startsWith("/create-pet"), label: "创建宠物" },
];

type AppHeaderNavProps = {
  compact?: boolean;
  currentPetName?: string | null;
  currentPetMeta?: string | null;
};

function getCurrentPageLabel(pathname: string) {
  return PAGE_LABELS.find((item) => item.matcher(pathname))?.label ?? "小窝";
}

export function AppHeaderNav({
  compact = false,
  currentPetName = null,
  currentPetMeta = null,
}: AppHeaderNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentPageLabel = getCurrentPageLabel(pathname);

  const handleLogout = async () => {
    try {
      await logoutCurrentSession();
    } catch {
      clearStoredAuth();
    }

    clearStoredPetId();
    router.replace("/");
  };

  return (
    <header className={cx("mb-6 animate-[soft-enter_420ms_ease-out_both]", compact ? "mb-4" : "sm:mb-8")}>
      <div className="flex flex-col gap-3 rounded-full border border-[#f0dfc9] bg-[#fffdf8]/90 px-4 py-3 shadow-[0_18px_48px_-38px_rgba(112,82,55,0.34)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/home"
            aria-label="回到宠物小窝"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f2dfc4] text-lg shadow-inner ring-1 ring-[#ead8c0]"
          >
            <span aria-hidden="true">🐾</span>
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#4b382c]">
              Pet Social
            </p>
            <p className="mt-0.5 truncate text-xs text-[#8f7b6a]">
              {currentPageLabel}
            </p>
          </div>
        </div>

        <nav
          aria-label="主导航"
          className="order-3 -mx-1 overflow-x-auto px-1 pb-1 sm:order-2 sm:mx-0 sm:max-w-[560px] sm:px-0"
        >
          <div className="flex min-w-max items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(ui.tab, "px-4 py-2", isActive && ui.tabActive)}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="order-2 flex min-w-0 flex-wrap items-center gap-2 sm:order-3 sm:justify-end">
          {currentPetName ? (
            <Link
              href="/my-pet"
              className="min-w-0 rounded-full border border-[#ead8c0] bg-[#fffaf3] px-4 py-2 text-left transition hover:bg-white"
            >
              <p className="truncate text-xs text-[#9c8775]">正在等你</p>
              <p className="truncate text-sm font-semibold text-[#4b382c]">
                {currentPetName}
                {currentPetMeta ? (
                  <span className="ml-2 font-medium text-[#8f7b6a]">
                    {currentPetMeta}
                  </span>
                ) : null}
              </p>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => void handleLogout()}
            className={cx(ui.buttonOutline, "px-4 py-2 text-xs")}
          >
            退出
          </button>
        </div>
      </div>
    </header>
  );
}
