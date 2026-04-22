export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const softShadow = "shadow-[0_24px_70px_-42px_rgba(112,82,55,0.42)]";
const liftTransition =
  "transition duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0";
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b58a61]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff9f1]";

export const ui = {
  pageShell:
    "min-h-dvh bg-[#fff8ef] px-4 py-5 text-[#5f4b3d] sm:px-6 sm:py-7 lg:px-8 lg:py-9",
  pageInner: "mx-auto w-full max-w-7xl",
  pageHero:
    "mb-6 rounded-[28px] border border-[#f0dfc9] bg-[#fffdf8] px-5 py-5 shadow-[0_22px_70px_-48px_rgba(112,82,55,0.38)] sm:px-6",
  pageEyebrow: "text-xs font-semibold uppercase tracking-[0.18em] text-[#a8794f]",
  pageTitle: "mt-2 text-3xl font-semibold tracking-tight text-[#4b382c] sm:text-4xl",
  pageLead: "mt-3 max-w-3xl text-sm leading-7 text-[#78675a] sm:text-base",
  panelHeader:
    "flex flex-wrap items-start justify-between gap-3 border-b border-[#f1e4d2] pb-4",
  sectionTitle: "text-xl font-semibold tracking-tight text-[#4b382c]",

  cardPrimary:
    `rounded-[30px] border border-[#f0dfc9] bg-[#fffdf8] ${softShadow}`,
  cardSecondary:
    "rounded-[26px] border border-[#f2e2cf] bg-[#fff6ea] shadow-[0_18px_52px_-42px_rgba(112,82,55,0.32)]",
  cardMuted:
    "rounded-[24px] border border-[#f0e5d7] bg-[#fbf1e4] shadow-[0_12px_38px_-34px_rgba(112,82,55,0.28)]",
  cardElevated:
    `rounded-[30px] border border-[#efdcc4] bg-[#fffdf8] ${softShadow}`,
  sidebarPanel:
    `rounded-[30px] border border-[#f0dfc9] bg-[#fffdf8] ${softShadow}`,
  floatingPanel:
    "rounded-[24px] border border-[#ead7bf] bg-[#fffdf8]/98 p-4 shadow-[0_28px_72px_-36px_rgba(112,82,55,0.48)] backdrop-blur",

  buttonPrimary:
    `inline-flex items-center justify-center rounded-full bg-[#8b6447] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_-24px_rgba(112,82,55,0.9)] ${liftTransition} hover:bg-[#76553e] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${focusRing}`,
  buttonSecondary:
    `inline-flex items-center justify-center rounded-full bg-[#f2dfc4] px-5 py-3 text-sm font-semibold text-[#76553e] ${liftTransition} hover:bg-[#ead0ac] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${focusRing}`,
  buttonOutline:
    `inline-flex items-center justify-center rounded-full border border-[#dcc8ae] bg-[#fffdf8]/80 px-5 py-3 text-sm font-medium text-[#6f5b4c] ${liftTransition} hover:border-[#c7aa84] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${focusRing}`,
  buttonDanger:
    `inline-flex items-center justify-center rounded-full border border-[#efc7bd] bg-[#fff2ef] px-5 py-3 text-sm font-semibold text-[#a45d4d] transition hover:bg-[#ffe7e1] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`,
  buttonSubtle:
    `text-sm font-medium text-[#7d6858] transition hover:text-[#4b382c] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`,
  iconButton:
    `inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dcc8ae] bg-[#fffdf8] text-sm font-semibold text-[#6f5b4c] transition hover:bg-[#fff6ea] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`,

  input:
    `w-full rounded-[20px] border border-[#dcc8ae] bg-[#fffaf3] px-4 py-3 text-[#4b382c] outline-none transition placeholder:text-[#b4a391] focus:border-[#b58a61] focus:bg-white focus:shadow-[0_0_0_4px_rgba(181,138,97,0.14)] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`,
  tab:
    `inline-flex shrink-0 items-center justify-center rounded-full border border-[#ead8c0] bg-[#fffaf3] px-4 py-2 text-sm font-medium text-[#7d6858] transition hover:bg-white hover:text-[#4b382c] ${focusRing}`,
  tabActive:
    "border-[#d0ad82] !bg-[#fffdf8] !text-[#4b382c] shadow-[0_12px_30px_-24px_rgba(112,82,55,0.9)] hover:!bg-[#fffdf8] hover:!text-[#4b382c]",

  badge:
    "inline-flex items-center rounded-full border border-[#ead8c0] bg-[#fffaf3] px-3 py-1 text-xs font-semibold text-[#7d6858]",
  badgeSuccess:
    "inline-flex items-center rounded-full border border-[#cfe8cf] bg-[#f0fbf1] px-3 py-1 text-xs font-semibold text-[#4f8a55]",
  badgeWarning:
    "inline-flex items-center rounded-full border border-[#f0d29c] bg-[#fff7df] px-3 py-1 text-xs font-semibold text-[#9a7030]",
  badgeNeutral:
    "inline-flex items-center rounded-full border border-[#ead8c0] bg-[#fffaf3] px-3 py-1 text-xs font-semibold text-[#7d6858]",
  badgeError:
    "inline-flex items-center rounded-full border border-[#efc7bd] bg-[#fff2ef] px-3 py-1 text-xs font-semibold text-[#a45d4d]",

  noticeSuccess:
    "rounded-[20px] border border-[#cfe8cf] bg-[#f0fbf1] px-4 py-3 text-sm leading-6 text-[#4f8a55]",
  noticeError:
    "rounded-[20px] border border-[#efc7bd] bg-[#fff2ef] px-4 py-3 text-sm leading-6 text-[#a45d4d]",
  noticeInfo:
    "rounded-[20px] border border-[#f0d29c] bg-[#fff7df] px-4 py-3 text-sm leading-6 text-[#8c6837]",

  stickyActionBar:
    "sticky top-3 z-20 rounded-[24px] border border-[#d9bea0] bg-[#8b6447] px-4 py-3 text-white shadow-[0_22px_55px_-30px_rgba(112,82,55,0.72)]",
  emptyState:
    "rounded-[28px] border border-dashed border-[#dcc8ae] bg-[#fffdf8]/78 px-6 py-8 text-center text-sm leading-7 text-[#7d6858]",
  skeleton:
    "animate-pulse rounded-[28px] border border-[#f0e5d7] bg-gradient-to-r from-[#f4e7d5] via-[#fffdf8] to-[#f4e7d5]",

  // Backward-compatible aliases used by existing pages.
  card: `rounded-[30px] border border-[#f0dfc9] bg-[#fffdf8] ${softShadow}`,
  cardWarm:
    "rounded-[30px] border border-[#efdcc4] bg-[#fff8ee] shadow-[0_24px_70px_-42px_rgba(112,82,55,0.38)]",
  cardInset:
    "rounded-[24px] border border-[#f1e4d2] bg-[#fffdf8] shadow-[0_16px_42px_-34px_rgba(112,82,55,0.3)]",
  cardSoft:
    "rounded-[24px] border border-[#f0e5d7] bg-[#fbf1e4] p-4 shadow-[0_12px_38px_-34px_rgba(112,82,55,0.28)]",
  cardGhost:
    "rounded-[28px] border border-dashed border-[#dcc8ae] bg-[#fffaf3] p-8",
  chip:
    "rounded-full border border-[#ead8c0] bg-[#fffdf8] px-3 py-1 text-xs font-medium text-[#8b6447] shadow-sm",
  pill:
    "rounded-full bg-[#fffaf3] px-3 py-1 text-xs font-medium text-[#7d6858] shadow-sm",
  statusBadgeSuccess:
    "rounded-full border border-[#cfe8cf] bg-[#f0fbf1] px-3 py-1 text-xs font-semibold text-[#4f8a55]",
  statusBadgeWarning:
    "rounded-full border border-[#f0d29c] bg-[#fff7df] px-3 py-1 text-xs font-semibold text-[#9a7030]",
  statusBadgeNeutral:
    "rounded-full border border-[#ead8c0] bg-[#fffaf3] px-3 py-1 text-xs font-semibold text-[#7d6858]",
  statusBadgeError:
    "rounded-full border border-[#efc7bd] bg-[#fff2ef] px-3 py-1 text-xs font-semibold text-[#a45d4d]",
  skeletonBlock:
    "animate-pulse rounded-[28px] border border-[#f0e5d7] bg-gradient-to-r from-[#f4e7d5] via-[#fffdf8] to-[#f4e7d5]",
  emptyText: "text-sm leading-7 text-[#7d6858]",
} as const;
