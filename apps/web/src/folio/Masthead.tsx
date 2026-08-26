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
    <header className="flex items-baseline justify-between gap-4 border-b border-rule pb-5">
      <BrandLockup to={lockupTo} />
      {children}
    </header>
  );
}
