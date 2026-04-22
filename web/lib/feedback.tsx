import type { ReactNode } from "react";

import { cx, ui } from "./ui";

export type NoticeTone = "success" | "warning" | "neutral" | "error" | "info";

type NoticeBannerProps = {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
};

const noticeClassByTone: Record<NoticeTone, string> = {
  success: ui.noticeSuccess,
  warning: ui.noticeInfo,
  neutral:
    "rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600",
  error: ui.noticeError,
  info: ui.noticeInfo,
};

export function NoticeBanner({
  tone = "info",
  children,
  className,
}: NoticeBannerProps) {
  return <div className={cx(noticeClassByTone[tone], className)}>{children}</div>;
}

type SkeletonBlockProps = {
  className?: string;
  label?: string;
};

export function SkeletonBlock({ className, label = "正在加载" }: SkeletonBlockProps) {
  return (
    <div
      className={cx(ui.skeletonBlock, "min-h-24", className)}
      aria-busy="true"
      aria-label={label}
    />
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx(ui.emptyState, className)}>
      <p className="text-base font-semibold text-stone-950">{title}</p>
      <p className="mt-2">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
