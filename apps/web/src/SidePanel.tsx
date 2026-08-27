import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

const LG_QUERY = "(min-width: 1024px)";

export type SidePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Label for the toggle button when closed on mobile (also used as accessible name). */
  triggerLabel: string;
  side?: "left" | "right";
  children: ReactNode;
  /** Extra class for the panel width, borders, etc. */
  className?: string;
  /** Focus returns here when the overlay closes. */
  triggerRef?: RefObject<HTMLElement | null>;
};

function useIsLgUp(): boolean {
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(LG_QUERY).matches : true,
  );

  useEffect(() => {
    const media = window.matchMedia(LG_QUERY);
    const sync = () => setIsLgUp(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isLgUp;
}

/**
 * Panel chrome: fixed in-flow from `lg` up; below that, a dismissible overlay.
 * Parent owns the open button and passes `open` / `onOpenChange` (+ optional `triggerRef`).
 */
export function SidePanel({
  open,
  onOpenChange,
  title,
  triggerLabel,
  side = "right",
  children,
  className = "",
  triggerRef,
}: SidePanelProps) {
  const isLgUp = useIsLgUp();
  const titleId = useId();
  const label = title ?? triggerLabel;
  const showOverlay = !isLgUp && open;
  const showPanel = isLgUp || open;
  const wasOverlayOpen = useRef(false);

  useEffect(() => {
    if (!showOverlay) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showOverlay, onOpenChange]);

  useEffect(() => {
    if (showOverlay) {
      wasOverlayOpen.current = true;
      return;
    }
    if (wasOverlayOpen.current) {
      wasOverlayOpen.current = false;
      triggerRef?.current?.focus();
    }
  }, [showOverlay, triggerRef]);

  if (!showPanel) return null;

  const sideEdge = side === "left" ? "border-r border-rule left-0" : "border-l border-rule right-0";

  const panelClasses = showOverlay
    ? `fixed inset-y-0 z-40 w-[min(100%,22rem)] max-w-[85vw] overflow-y-auto bg-paper-deep ${sideEdge}`
    : `shrink-0 overflow-y-auto bg-paper-deep ${sideEdge}`;

  return (
    <>
      {showOverlay && (
        <button
          type="button"
          data-testid="side-panel-backdrop"
          aria-label="Close panel"
          className="fixed inset-0 z-30 bg-ink/25"
          onClick={() => onOpenChange(false)}
        />
      )}
      <aside
        role="complementary"
        aria-label={label}
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`${panelClasses} ${className}`.trim()}
      >
        {title ? (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        ) : null}
        {children}
      </aside>
    </>
  );
}
