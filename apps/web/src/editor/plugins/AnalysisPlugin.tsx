import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { AnalysisResult } from "@writing-helper/analysis";
import { useEffect, useRef } from "react";
import { runAnalysis } from "../../analysis/run-analysis";
import { clearHighlights, paintHighlights } from "../highlight-painter";
import { buildTextIndex, type TextIndex } from "../text-index";

const DEBOUNCE_MS = 150;

interface AnalysisPluginProps {
  /** Tắt ở chế độ Write: không phân tích, không tô màu. */
  enabled: boolean;
  onResult: (result: AnalysisResult | null, index: TextIndex | null) => void;
}

/**
 * Sau mỗi lần gõ: dựng lại chỉ mục văn bản từ DOM của editor, phân tích, tô màu.
 *
 * Cố tình đọc DOM thay vì editor state — chỉ mục dùng chung cho cả việc tô màu
 * lẫn dò con trỏ, nên nó phải khớp với đúng những gì đang hiển thị.
 */
export function AnalysisPlugin({ enabled, onResult }: AnalysisPluginProps) {
  const [editor] = useLexicalComposerContext();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const runIdRef = useRef(0);

  // Giữ callback trong ref để mỗi lần parent render lại không phải gỡ và gắn
  // lại listener của editor.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!enabled) {
      clearHighlights();
      onResultRef.current(null, null);
      return;
    }

    const schedule = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const root = editor.getRootElement();
        if (!root) return;

        const index = buildTextIndex(root);
        const runId = ++runIdRef.current;

        void runAnalysis(index.text).then((result) => {
          // Bỏ kết quả cũ về muộn hơn kết quả mới.
          if (runId !== runIdRef.current) return;

          paintHighlights(index, result.highlights);
          onResultRef.current(result, index);
        });
      }, DEBOUNCE_MS);
    };

    schedule();
    const unregister = editor.registerUpdateListener(schedule);

    return () => {
      clearTimeout(timerRef.current);
      unregister();
    };
  }, [editor, enabled]);

  useEffect(() => clearHighlights, []);

  return null;
}
