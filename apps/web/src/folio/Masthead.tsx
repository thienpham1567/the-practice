import type { ReactNode } from "react";
import { BrandLockup } from "../BrandLockup";

export function Masthead({
  children,
  lockupTo,
}: {
  children?: ReactNode;
  lockupTo?: string;
}) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3 border-b border-rule pb-5">
      <BrandLockup to={lockupTo} size="sm" />
      {children ? <div className="min-w-0 max-w-full">{children}</div> : null}
    </header>
  );
}
