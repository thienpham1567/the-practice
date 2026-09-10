import { Link } from "react-router-dom";
import { AppMark } from "./AppMark";
import { APP_NAME } from "./brand";

const MARK = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-11 w-11",
  xl: "h-12 w-12",
} as const;
const TYPE = {
  sm: "text-[1.1875rem]",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
} as const;
const GAP = {
  sm: "gap-2.5",
  md: "gap-2.5",
  lg: "gap-3",
  xl: "gap-3.5",
} as const;

interface BrandLockupProps {
  to?: string;
  size?: keyof typeof MARK;
}

/** Mark + wordmark ngang. Truyền `to` thì là link; không thì chỉ là nhận diện. */
export function BrandLockup({ to, size = "md" }: BrandLockupProps) {
  const body = (
    <>
      <AppMark className={`${MARK[size]} shrink-0`} />
      <span className="italic">{APP_NAME}</span>
    </>
  );

  const classes = `inline-flex items-center ${GAP[size]} font-display ${TYPE[size]} font-normal leading-none tracking-[0.02em]`;

  if (!to) {
    return <p className={`relative ${classes}`}>{body}</p>;
  }

  return (
    <Link to={to} className={`${classes} hover:text-vermilion`}>
      {body}
    </Link>
  );
}
