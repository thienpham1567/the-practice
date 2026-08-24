/**
 * Khớp cụm từ theo từ điển. Dùng chung cho rule qualifier và complex-phrase —
 * hai rule khác nhau ở dữ liệu, không khác ở cách tìm.
 * Internal — không nằm trong interface công khai của package.
 */

export interface PhraseMatch {
  start: number;
  end: number;
  /** Dạng chuẩn trong từ điển, không phải dạng xuất hiện trong text. */
  phrase: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Biên dịch từ điển thành một matcher tái sử dụng được.
 *
 * Cụm dài được thử trước nên "a number of" thắng "a number"; regex tự đẩy con
 * trỏ qua chỗ đã khớp nên kết quả không bao giờ chồng lấn.
 */
export function createPhraseMatcher(phrases: Iterable<string>): (text: string) => PhraseMatch[] {
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return () => [];

  const pattern = new RegExp(`\\b(?:${sorted.map(escapeRegExp).join("|")})\\b`, "gi");

  return (text: string): PhraseMatch[] => {
    const matches: PhraseMatch[] = [];
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        phrase: match[0].toLowerCase(),
      });
    }

    return matches;
  };
}
