import {
  $createRangeSelection,
  $getNearestNodeFromDOMNode,
  $isTextNode,
  $setSelection,
  type LexicalEditor,
} from "lexical";
import { rangeFor, type TextIndex } from "./text-index";

/**
 * Thay thế đoạn `[start, end)` trên `index.text` bằng `replacement`, đi qua
 * đúng selection API của Lexical thay vì sửa DOM trực tiếp — sửa DOM tay sẽ
 * làm EditorState của Lexical lệch khỏi DOM thật và hỏng ở lần update kế tiếp.
 *
 * Dựa trên việc mỗi DOM Text node trong `index` ứng đúng 1-1 với một TextNode
 * của Lexical — đúng với text thường/in đậm/nghiêng dùng trong app này; nếu
 * sau này có decorator node thì cách này cần xem lại.
 */
export function replaceTextRange(
  editor: LexicalEditor,
  index: TextIndex,
  start: number,
  end: number,
  replacement: string,
): void {
  const range = rangeFor(index, start, end);
  if (!range) return;

  editor.update(() => {
    const anchorNode = $getNearestNodeFromDOMNode(range.startContainer);
    const focusNode = $getNearestNodeFromDOMNode(range.endContainer);
    if (!anchorNode || !focusNode || !$isTextNode(anchorNode) || !$isTextNode(focusNode)) return;

    const selection = $createRangeSelection();
    selection.anchor.set(anchorNode.getKey(), range.startOffset, "text");
    selection.focus.set(focusNode.getKey(), range.endOffset, "text");
    $setSelection(selection);
    selection.insertText(replacement);
  });
}
