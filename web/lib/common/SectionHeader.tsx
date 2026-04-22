import type { ReactNode } from "react";

import { cx, ui } from "../ui";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3", className)}>
      <div>
        {eyebrow ? <p className={ui.pageEyebrow}>{eyebrow}</p> : null}
        <h2 className={ui.sectionTitle}>{title}</h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7d6858]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
