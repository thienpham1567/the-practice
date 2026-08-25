import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { useQuery } from "@tanstack/react-query";
import type { AnalysisResult, Highlight } from "@writing-helper/analysis";
import { $getRoot, type SerializedEditorState } from "lexical";
import { useCallback, useRef, useState } from "react";
import { getAiStatus } from "../api/ai";
import { shouldFlipBelow } from "./anchor-position";
import {
  buildRewriteRequest,
  buildSelectionRewriteRequest,
  type RewriteRequestSpan,
} from "./build-rewrite-request";
import { describeHighlight } from "./highlight-copy";
import { findHighlightAtOffset, offsetAtPoint } from "./highlight-hit";
import { AnalysisPlugin } from "./plugins/AnalysisPlugin";
import { ToolbarPlugin } from "./plugins/ToolbarPlugin";
import { replaceTextRange } from "./replace-range";
import { RewritePopover, type RewriteTarget } from "./RewritePopover";
import { offsetOf, type TextIndex } from "./text-index";
import { editorTheme } from "./theme";

export type EditorMode = "write" | "edit";

export interface EditorChange {
  editorState: SerializedEditorState;
  plainText: string;
}

interface EditorProps {
  mode: EditorMode;
  /** Editor state đã serialize; bỏ trống là bắt đầu với trang trắng. */
  initialEditorState?: SerializedEditorState | null;
  onChange: (change: EditorChange) => void;
  onAnalysis: (result: AnalysisResult | null) => void;
}

interface HoverState {
  highlight: Highlight;
  x: number;
  y: number;
}

interface SelectionTrigger {
  x: number;
  y: number;
  start: number;
  end: number;
}

/**
 * Vùng soạn thảo: rich text, phân tích realtime, tô màu và tooltip.
 *
 * Caller chỉ cần biết chế độ hiện tại, nội dung ban đầu và hai callback — mọi
 * chuyện về Lexical, offset và tô màu nằm gọn bên trong.
 */
export function Editor({ mode, initialEditorState, onChange, onAnalysis }: EditorProps) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: "writing-helper",
        theme: editorTheme,
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
        editorState: initialEditorState ? JSON.stringify(initialEditorState) : null,
        onError: (error) => {
          throw error;
        },
      }}
    >
      <EditorBody mode={mode} onChange={onChange} onAnalysis={onAnalysis} />
    </LexicalComposer>
  );
}

interface EditorBodyProps {
  mode: EditorMode;
  onChange: (change: EditorChange) => void;
  onAnalysis: (result: AnalysisResult | null) => void;
}

function EditorBody({ mode, onChange, onAnalysis }: EditorBodyProps) {
  const [editor] = useLexicalComposerContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{ index: TextIndex | null; highlights: Highlight[] }>({
    index: null,
    highlights: [],
  });

  const [hover, setHover] = useState<HoverState | null>(null);
  const [selectionTrigger, setSelectionTrigger] = useState<SelectionTrigger | null>(null);
  const [popover, setPopover] = useState<RewriteTarget | null>(null);

  // Đọc một lần và cache toàn phiên: bật/tắt tính năng AI không đổi giữa chừng.
  const aiStatus = useQuery({
    queryKey: ["ai-status"],
    queryFn: getAiStatus,
    staleTime: Infinity,
  });
  const aiEnabled = aiStatus.data?.enabled ?? false;

  const closeOverlays = useCallback(() => {
    setHover(null);
    setSelectionTrigger(null);
    setPopover(null);
  }, []);

  const handleResult = useCallback(
    (result: AnalysisResult | null, index: TextIndex | null) => {
      stateRef.current = { index, highlights: result?.highlights ?? [] };
      if (!result) closeOverlays();
      onAnalysis(result);
    },
    [onAnalysis, closeOverlays],
  );

  const containerPoint = (clientX: number, clientY: number) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    return { x: clientX - (bounds?.left ?? 0), y: clientY - (bounds?.top ?? 0) };
  };

  const handlePointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const { index, highlights } = stateRef.current;
    if (!index || highlights.length === 0 || popover) {
      if (hover) setHover(null);
      return;
    }

    const offset = offsetAtPoint(index, event.clientX, event.clientY);
    const found = offset === null ? null : findHighlightAtOffset(highlights, offset);

    if (!found) {
      if (hover) setHover(null);
      return;
    }

    setHover({ highlight: found, ...containerPoint(event.clientX, event.clientY) });
  };

  const openPopover = (span: RewriteRequestSpan, point: { x: number; y: number }, highlight?: Highlight) => {
    setHover(null);
    setSelectionTrigger(null);
    setPopover({ span, x: point.x, y: point.y, highlight });
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!aiEnabled) return;
    const { index, highlights } = stateRef.current;
    if (!index) return;

    const offset = offsetAtPoint(index, event.clientX, event.clientY);
    const found = offset === null ? null : findHighlightAtOffset(highlights, offset);

    if (!found) {
      if (popover) setPopover(null);
      return;
    }

    const span = buildRewriteRequest(index.text, found);
    if (span) openPopover(span, containerPoint(event.clientX, event.clientY), found);
  };

  const handleMouseUp = () => {
    if (!aiEnabled) return;
    const { index } = stateRef.current;
    const selection = window.getSelection();

    if (!index || !selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSelectionTrigger(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!containerRef.current?.contains(range.commonAncestorContainer)) {
      setSelectionTrigger(null);
      return;
    }

    const start = offsetOf(index, range.startContainer, range.startOffset);
    const end = offsetOf(index, range.endContainer, range.endOffset);
    if (start === null || end === null || end <= start) {
      setSelectionTrigger(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    setSelectionTrigger({ ...containerPoint(rect.right, rect.bottom), start, end });
  };

  const handleFixSelection = () => {
    if (!selectionTrigger) return;
    const { index } = stateRef.current;
    if (!index) return;

    const span = buildSelectionRewriteRequest(index.text, selectionTrigger.start, selectionTrigger.end);
    if (span) openPopover(span, { x: selectionTrigger.x, y: selectionTrigger.y });
  };

  /**
   * Dùng chung cho Apply và Dismiss. Cả hai đều là click bên trong container,
   * và nếu popover được mở từ "Fix selection" thì browser selection cũ vẫn
   * còn active — không xoá thì onMouseUp của chính cú click này sẽ đọc lại
   * đúng selection đó và hiện lại nút "Fix with AI" ngay chỗ vừa xử lý xong.
   */
  const closePopover = () => {
    window.getSelection()?.removeAllRanges();
    setSelectionTrigger(null);
    setPopover(null);
  };

  const handleApply = (replacement: string) => {
    const { index } = stateRef.current;
    if (index && popover) replaceTextRange(editor, index, popover.span.start, popover.span.end, replacement);
    closePopover();
  };

  return (
    <>
      <div className="border-b border-rule bg-paper/80 px-6 py-2 backdrop-blur">
        <div className="mx-auto max-w-[46rem]">
          <ToolbarPlugin />
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto"
        onMouseMove={handlePointerMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleClick}
        onMouseUp={handleMouseUp}
      >
        <div className="mx-auto max-w-[46rem] px-6 py-12">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="min-h-[60vh] text-[1.15rem] leading-[1.75] outline-none"
                aria-label="Document text"
              />
            }
            placeholder={
              <p className="pointer-events-none absolute top-12 text-[1.15rem] text-ink-faint">
                Write something worth editing.
              </p>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>

        {hover && !popover && <HighlightTooltip hover={hover} />}

        {selectionTrigger && !popover && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleFixSelection();
            }}
            className="absolute z-20 -translate-y-full bg-ink px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-paper hover:bg-vermilion"
            style={{ left: selectionTrigger.x, top: selectionTrigger.y - 6 }}
          >
            Fix with AI
          </button>
        )}

        {popover && (
          <RewritePopover target={popover} onApply={handleApply} onClose={closePopover} />
        )}
      </div>

      <HistoryPlugin />
      <ListPlugin />
      <AnalysisPlugin enabled={mode === "edit"} onResult={handleResult} />
      <OnChangePlugin
        ignoreSelectionChange
        onChange={(editorState) => {
          onChange({
            editorState: editorState.toJSON(),
            plainText: editorState.read(() => $getRoot().getTextContent()),
          });
        }}
      />
    </>
  );
}

function HighlightTooltip({ hover }: { hover: HoverState }) {
  const { label, advice } = describeHighlight(hover.highlight);
  // Highlight nằm sát đỉnh khung (ngay dưới toolbar) thì bung lên trên sẽ bị
  // toolbar che mất — lật xuống dưới điểm hover thay vào đó.
  const flipBelow = shouldFlipBelow(hover.y);

  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute z-20 max-w-64 -translate-x-1/2 rounded-sm border border-rule bg-paper px-3 py-2 shadow-[0_6px_20px_-8px_rgba(31,28,24,0.4)] ${
        flipBelow ? "" : "-translate-y-full"
      }`}
      style={{ left: hover.x, top: hover.y + (flipBelow ? 14 : -10) }}
    >
      <p className="font-mono text-[0.7rem] uppercase tracking-wider text-vermilion">{label}</p>
      {advice && <p className="mt-1 text-sm leading-snug text-ink-soft">{advice}</p>}
    </div>
  );
}
