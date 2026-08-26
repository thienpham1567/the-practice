import { Link } from "react-router-dom";
import { AppMark } from "./AppMark";
import { APP_NAME } from "./brand";

const MARK = { sm: "h-6 w-6", md: "h-7 w-7", lg: "h-10 w-10", xl: "h-16 w-16" } as const;
const TYPE = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-3xl",
} as const;

interface BrandLockupProps {
  to?: string;
  size?: keyof typeof MARK;
}

/** Mark + wordmark. Truyền `to` thì là link; không thì chỉ là nhận diện. */
export function BrandLockup({ to, size = "md" }: BrandLockupProps) {
  const stacked = size === "xl";
  const body = (
    <>
      <AppMark className={`${MARK[size]} shrink-0 text-vermilion`} />
      <span>{APP_NAME}</span>
    </>
  );

  const classes = stacked
    ? `inline-flex flex-col items-start gap-3 font-display text-3xl font-semibold tracking-tight`
    : `inline-flex items-center gap-2.5 font-display font-semibold tracking-tight ${TYPE[size]}`;

  if (!to) {
    return <p className={`relative ${classes}`}>{body}</p>;
  }

  return (
    <Link to={to} className={`${classes} hover:text-vermilion`}>
      {body}
    </Link>
  );
}
