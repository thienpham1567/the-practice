import { useEffect, useRef } from "react";

const LAMP_EASE = 0.08;

export function finePointerMotionEnabled(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return (
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isTypingSurface(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (node.isContentEditable) return true;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * A blot of warm ink that lags the pointer — light on the desk, not a HUD.
 */
export function CursorLamp() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!finePointerMotionEnabled()) return;
    const root = rootRef.current;
    if (!root) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 3;
    let lampX = targetX;
    let lampY = targetY;
    let seen = false;
    let frame = 0;

    const tick = () => {
      lampX += (targetX - lampX) * LAMP_EASE;
      lampY += (targetY - lampY) * LAMP_EASE;
      root.style.setProperty("--lamp-x", `${lampX}px`);
      root.style.setProperty("--lamp-y", `${lampY}px`);
      if (seen) frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      root.dataset.writing = isTypingSurface(event.target) ? "true" : "false";
      if (!seen) {
        seen = true;
        lampX = targetX;
        lampY = targetY;
        root.dataset.active = "true";
        frame = requestAnimationFrame(tick);
      }
    };

    const onLeave = () => {
      seen = false;
      root.dataset.active = "false";
      cancelAnimationFrame(frame);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  if (!finePointerMotionEnabled()) return null;

  return (
    <div ref={rootRef} className="cursor-lamp" aria-hidden="true" data-cursor-lamp="true">
      <div className="cursor-lamp__bloom" />
    </div>
  );
}
