import type { ReactNode } from "react";
import { BrandLockup } from "../BrandLockup";
import { ThemeToggle } from "./ThemeToggle";

export function Masthead({
  children,
  lockupTo,
  lockupSize = "sm",
  className,
  deskToggle = false,
}: {
  children?: ReactNode;
  lockupTo?: string;
  lockupSize?: "sm" | "md";
  className?: string;
  deskToggle?: boolean;
}) {
  return (
    <header
      className={
        className
          ? `flex flex-wrap items-center justify-between gap-x-4 gap-y-3 ${className}`
          : "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-rule pb-5"
      }
    >
      <BrandLockup to={lockupTo} size={lockupSize} />
      <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-x-6 gap-y-2">
        {children}
        {deskToggle ? (
          <div className="desk-theme-toggle">
            <ThemeToggle />
          </div>
        ) : (
          <ThemeToggle />
        )}
      </div>
    </header>
  );
}
