import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import type { AnalysisResult, Highlight } from "@writing-helper/analysis";
import { $getRoot, type SerializedEditorState } from "lexical";
import { useCallback, useRef, useState } from "react";
import { describeHighlight } from "./highlight-copy";
import { findHighlightAtOffset, offsetAtPoint } from "./highlight-hit";
import { AnalysisPlugin } from "./plugins/AnalysisPlugin";
import { ToolbarPlugin } from "./plugins/ToolbarPlugin";
import type { TextIndex } from "./text-index";
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

/**
 * Vùng soạn thảo: rich text, phân tích realtime, tô màu và tooltip.
 *
 * Caller chỉ cần biết chế độ hiện tại, nội dung ban đầu và hai callback — mọi
 * chuyện về Lexical, offset và tô màu nằm gọn bên trong.
 */
export function Editor({ mode, initialEditorState, onChange, onAnalysis }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{ index: TextIndex | null; highlights: Highlight[] }>({
    index: null,
    highlights: [],
  });
  const [hover, setHover] = useState<HoverState | null>(null);

  const handleResult = useCallback(
    (result: AnalysisResult | null, index: TextIndex | null) => {
      stateRef.current = { index, highlights: result?.highlights ?? [] };
      if (!result) setHover(null);
      onAnalysis(result);
    },
    [onAnalysis],
  );

  const handlePointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const { index, highlights } = stateRef.current;
    if (!index || highlights.length === 0) {
      if (hover) setHover(null);
      return;
    }

    const offset = offsetAtPoint(index, event.clientX, event.clientY);
    const found = offset === null ? null : findHighlightAtOffset(highlights, offset);

    if (!found) {
      if (hover) setHover(null);
      return;
    }

    const bounds = containerRef.current?.getBoundingClientRect();
    setHover({
      highlight: found,
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
    });
  };

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

        {hover && <HighlightTooltip hover={hover} />}
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
    </LexicalComposer>
  );
}

function HighlightTooltip({ hover }: { hover: HoverState }) {
  const { label, advice } = describeHighlight(hover.highlight);

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 max-w-64 -translate-x-1/2 -translate-y-full rounded-sm border border-rule bg-paper px-3 py-2 shadow-[0_6px_20px_-8px_rgba(31,28,24,0.4)]"
      style={{ left: hover.x, top: hover.y - 10 }}
    >
      <p className="font-mono text-[0.7rem] uppercase tracking-wider text-vermilion">{label}</p>
      {advice && <p className="mt-1 text-sm leading-snug text-ink-soft">{advice}</p>}
    </div>
  );
}
