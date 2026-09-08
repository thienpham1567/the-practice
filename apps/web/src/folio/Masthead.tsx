import type { ReactNode } from "react";
import { BrandLockup } from "../BrandLockup";
import { ThemeToggle } from "./ThemeToggle";

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
      <div className="flex min-w-0 max-w-full flex-wrap items-baseline justify-end gap-x-6 gap-y-2">
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
