// 144px WebP: đủ nét cho mark 48px ở màn 3x, nhẹ hơn PNG 256px gốc ~6 lần (14 KB so với 80 KB).
import appMark from "./assets/app-mark.webp";

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
