/**
 * Ánh xạ giữa offset ký tự (thứ `analyze()` làm việc) và DOM Range (thứ trình
 * duyệt tô màu và bắt con trỏ).
 *
 * Chuỗi văn bản được dựng từ chính DOM đang hiển thị, nên không có nguy cơ lệch
 * giữa hai nguồn: mọi ký tự trong `text` đều truy được về một text node cụ thể,
 * trừ dấu ngăn đoạn vốn không tồn tại trong DOM.
 */

export interface TextSegment {
  node: Text;
  /** Offset của ký tự đầu tiên của node này trong `TextIndex.text`. */
  start: number;
  end: number;
}

export interface TextIndex {
  text: string;
  segments: TextSegment[];
}

const BLOCK_TAGS = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "DIV",
]);

/** Hai xuống dòng, khớp với cách `analyze()` đếm đoạn. */
const BLOCK_SEPARATOR = "\n\n";

function blockAncestor(node: Node, root: HTMLElement): Node {
  let current: Node | null = node.parentNode;

  while (current && current !== root) {
    if (current.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((current as Element).tagName)) {
      return current;
    }
    current = current.parentNode;
  }

  return root;
}

export function buildTextIndex(root: HTMLElement): TextIndex {
  const segments: TextSegment[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let text = "";
  let previousBlock: Node | null = null;

  let node = walker.nextNode() as Text | null;
  while (node !== null) {
    const content = node.data;

    if (content.length > 0) {
      const block = blockAncestor(node, root);
      if (previousBlock !== null && block !== previousBlock) text += BLOCK_SEPARATOR;
      previousBlock = block;

      segments.push({ node, start: text.length, end: text.length + content.length });
      text += content;
    }

    node = walker.nextNode() as Text | null;
  }

  return { text, segments };
}

/**
 * Vị trí trong DOM ứng với offset ký tự.
 * `atEnd` chọn cách xử lý khi offset rơi đúng ranh giới hai node: điểm kết thúc
 * thuộc về node trước, điểm bắt đầu thuộc về node sau.
 */
function locate(
  index: TextIndex,
  offset: number,
  atEnd: boolean,
): { node: Text; nodeOffset: number } | null {
  for (const segment of index.segments) {
    const inside = atEnd
      ? offset > segment.start && offset <= segment.end
      : offset >= segment.start && offset < segment.end;

    if (inside) return { node: segment.node, nodeOffset: offset - segment.start };

    // Offset rơi vào dấu ngăn đoạn: kéo về đầu node kế tiếp.
    if (!atEnd && offset < segment.start) return { node: segment.node, nodeOffset: 0 };
  }

  return null;
}

/** Range phủ đúng đoạn `[start, end)`, hoặc null nếu offset không hợp lệ. */
export function rangeFor(index: TextIndex, start: number, end: number): Range | null {
  if (end <= start) return null;

  const from = locate(index, start, false);
  const to = locate(index, end, true);
  if (!from || !to) return null;

  const range = document.createRange();
  range.setStart(from.node, from.nodeOffset);
  range.setEnd(to.node, to.nodeOffset);

  return range;
}

/** Offset ký tự ứng với một vị trí DOM, dùng để biết con trỏ đang ở chữ nào. */
export function offsetOf(index: TextIndex, node: Node, nodeOffset: number): number | null {
  const segment = index.segments.find((candidate) => candidate.node === node);
  return segment ? segment.start + nodeOffset : null;
}
