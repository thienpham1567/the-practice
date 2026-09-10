import appMark from "./assets/app-mark.png";

/** Con dấu ¶ letterpress — mark chính của The Practice. */
export function AppMark({ className }: { className?: string }) {
  return (
    <img
      src={appMark}
      alt=""
      draggable={false}
      className={`object-contain select-none ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
