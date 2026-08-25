import { Link } from "react-router-dom";
import { AppMark } from "./AppMark";
import { APP_NAME } from "./brand";

interface BrandLockupProps {
  to?: string;
  size?: "sm" | "md" | "lg";
}

const MARK = { sm: "h-6 w-6", md: "h-7 w-7", lg: "h-10 w-10" } as const;
const TYPE = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
} as const;

/** Mark + wordmark. Truyền `to` thì là link; không thì chỉ là nhận diện. */
export function BrandLockup({ to, size = "md" }: BrandLockupProps) {
  const body = (
    <>
      <AppMark className={`${MARK[size]} shrink-0 text-vermilion`} />
      <span>{APP_NAME}</span>
    </>
  );

  const classes = `inline-flex items-center gap-2.5 font-display font-semibold tracking-tight ${TYPE[size]}`;

  if (!to) {
    return <p className={`relative ${classes}`}>{body}</p>;
  }

  return (
    <Link to={to} className={`${classes} hover:text-vermilion`}>
      {body}
    </Link>
  );
}
