import { useState } from "react";
import { ApiError } from "../api/client";
import { requestRewrite } from "../api/ai";
import type { RewriteRequestSpan } from "./build-rewrite-request";
import { describeHighlight } from "./highlight-copy";
import { diffWords } from "./word-diff";
import type { Highlight } from "@writing-helper/analysis";

type Stage =
  | { name: "idle" }
  | { name: "loading" }
  | { name: "done"; suggestions: string[] }
  | { name: "error"; message: string };

export interface RewriteTarget {
  span: RewriteRequestSpan;
  x: number;
  y: number;
  /** Có khi trigger là click vào highlight; không có khi trigger là "Fix selection". */
  highlight?: Highlight;
}

interface RewritePopoverProps {
  target: RewriteTarget;
  onApply: (replacement: string) => void;
  onClose: () => void;
}

/** Dưới ngưỡng này thì không đủ chỗ phía trên điểm neo — lật popover xuống dưới. */
const FLIP_THRESHOLD_PX = 160;

export function RewritePopover({ target, onApply, onClose }: RewritePopoverProps) {
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const copy = target.highlight ? describeHighlight(target.highlight) : null;
  const flipBelow = target.y < FLIP_THRESHOLD_PX;

  const runFix = async () => {
    setStage({ name: "loading" });

    try {
      const { suggestions } = await requestRewrite(target.span.input);
      setStage({ name: "done", suggestions });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "AI rewrite failed";
      setStage({ name: "error", message });
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Fix with AI"
      // Chặn nổi bọt: nếu không, click vào nút bên trong popover sẽ bị handler
      // click của container (Editor.tsx) nhận thêm một lần, không thấy
      // highlight nào ở đúng toạ độ đó (vì đang che bởi popover), rồi tự đóng
      // popover ngay sau khi vừa mở/vừa xử lý xong.
      onClick={(event) => event.stopPropagation()}
      className={`absolute z-30 w-80 -translate-x-1/2 rounded-sm border border-rule bg-paper p-4 shadow-[0_12px_32px_-12px_rgba(31,28,24,0.45)] ${
        flipBelow ? "" : "-translate-y-full"
      }`}
      style={{ left: target.x, top: target.y + (flipBelow ? 16 : -12) }}
    >
      {copy && (
        <div className="mb-3 border-b border-rule pb-3">
          <p className="font-mono text-[0.7rem] uppercase tracking-wider text-vermilion">
            {copy.label}
          </p>
          {copy.advice && <p className="mt-1 text-sm leading-snug text-ink-soft">{copy.advice}</p>}
        </div>
      )}

      {stage.name === "idle" && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void runFix()}
            className="bg-ink px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-vermilion"
          >
            Fix with AI
          </button>
          <button type="button" onClick={onClose} className="text-sm text-ink-faint hover:text-ink">
            Dismiss
          </button>
        </div>
      )}

      {stage.name === "loading" && (
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          Thinking…
        </p>
      )}

      {stage.name === "done" && (
        <div className="space-y-2">
          {stage.suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion}
              original={target.span.input.text}
              suggestion={suggestion}
              onApply={() => onApply(suggestion)}
            />
          ))}
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-xs text-ink-faint hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      {stage.name === "error" && (
        <div>
          <p className="text-sm text-vermilion">{stage.message}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void runFix()}
              className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-soft hover:text-vermilion"
            >
              Try again
            </button>
            <button type="button" onClick={onClose} className="text-sm text-ink-faint hover:text-ink">
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  original,
  suggestion,
  onApply,
}: {
  original: string;
  suggestion: string;
  onApply: () => void;
}) {
  const tokens = diffWords(original, suggestion);

  return (
    <div className="border border-rule bg-paper-deep p-3">
      <p className="font-body text-sm leading-snug">
        {tokens.map((token, index) => (
          <span key={index}>
            {index > 0 && " "}
            <span className={token.changed ? "bg-mark-adverb" : undefined}>{token.text}</span>
          </span>
        ))}
      </p>
      <button
        type="button"
        onClick={onApply}
        className="mt-2 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-vermilion hover:underline"
      >
        Apply
      </button>
    </div>
  );
}
