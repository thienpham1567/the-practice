/**
 * Tách văn bản thành câu và từ, giữ offset chính xác trên chuỗi gốc.
 * Internal — không nằm trong interface công khai của package.
 */

export interface Word {
  text: string;
  start: number;
  end: number;
}

export interface Sentence {
  text: string;
  start: number;
  end: number;
  words: Word[];
}

/**
 * Viết tắt chỉ tính khi viết hoa. Nhiều mục trùng với từ thường trong tiếng Anh
 * ("sat", "no", "march", "co"), nên nếu bỏ qua chữ hoa thì câu "The cat sat."
 * sẽ không bao giờ được tách.
 */
const TITLE_CASE_ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "mt",
  "rev",
  "hon",
  "gen",
  "col",
  "capt",
  "sgt",
  "lt",
  "inc",
  "ltd",
  "co",
  "corp",
  "dept",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
  "mon",
  "tue",
  "tues",
  "wed",
  "thu",
  "thurs",
  "fri",
  "sat",
  "sun",
  "no",
  "vol",
  "fig",
  "ch",
  "u.s",
  "u.k",
]);

/** Viết tắt nhận diện được dù viết thường. */
const LOWERCASE_ABBREVIATIONS = new Set([
  "e.g",
  "i.e",
  "etc",
  "vs",
  "cf",
  "al",
  "approx",
  "a.m",
  "p.m",
  "pp",
]);

const WORD_PATTERN = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
const TERMINATORS = new Set([".", "!", "?"]);

/** Tách từ trong `text`; `offset` được cộng vào mọi vị trí trả về. */
export function splitWords(text: string, offset = 0): Word[] {
  const words: Word[] = [];
  WORD_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = WORD_PATTERN.exec(text)) !== null) {
    words.push({
      text: match[0],
      start: offset + match.index,
      end: offset + match.index + match[0].length,
    });
  }

  return words;
}

/**
 * Token ngay trước dấu chấm, dùng để nhận diện viết tắt.
 * Với "e.g." trả về "e.g"; với "Mr." trả về "Mr".
 */
function tokenBefore(text: string, dotIndex: number): string {
  let start = dotIndex;
  while (start > 0) {
    const char = text[start - 1]!;
    if (/[A-Za-z0-9.]/.test(char)) start--;
    else break;
  }
  return text.slice(start, dotIndex);
}

/** Dấu kết thúc tại `index` có thực sự kết thúc câu không? */
function endsSentence(text: string, index: number, runEnd: number): boolean {
  // Hết văn bản thì luôn là kết thúc câu.
  if (runEnd >= text.length) return true;

  // Phải có khoảng trắng ngay sau. "3.14" hay "U.S.A" không tách.
  if (!/\s/.test(text[runEnd]!)) return false;

  const char = text[index]!;
  if (char === "." && isAbbreviation(text, index)) return false;

  // Từ tiếp theo bắt đầu bằng chữ thường thì coi như câu chưa kết thúc
  // (bắt các trường hợp viết tắt ngoài danh sách, ví dụ "U.S. government").
  const rest = text.slice(runEnd);
  const nextChar = rest.match(/\S/)?.[0];
  if (nextChar !== undefined && /[a-z]/.test(nextChar)) return false;

  return true;
}

function isAbbreviation(text: string, dotIndex: number): boolean {
  const token = tokenBefore(text, dotIndex);
  if (token.length === 0) return false;

  // Chữ cái đơn viết hoa: tên viết tắt như "J. R. R. Tolkien".
  if (token.length === 1 && /[A-Z]/.test(token)) return true;

  const lower = token.toLowerCase();
  if (LOWERCASE_ABBREVIATIONS.has(lower)) return true;

  return /[A-Z]/.test(token[0]!) && TITLE_CASE_ABBREVIATIONS.has(lower);
}

/** Tách `text` thành câu, mỗi câu kèm danh sách từ. */
export function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  let cursor = 0;

  for (let i = 0; i < text.length; i++) {
    if (!TERMINATORS.has(text[i]!)) continue;

    // Gom chuỗi dấu kết thúc liền nhau: "?!", "..."
    let runEnd = i;
    while (runEnd < text.length && TERMINATORS.has(text[runEnd]!)) runEnd++;

    if (!endsSentence(text, i, runEnd)) {
      i = runEnd - 1;
      continue;
    }

    pushSentence(sentences, text, cursor, runEnd);
    cursor = runEnd;
    i = runEnd - 1;
  }

  // Phần đuôi không có dấu kết thúc.
  if (cursor < text.length) pushSentence(sentences, text, cursor, text.length);

  return sentences;
}

function pushSentence(sentences: Sentence[], text: string, from: number, to: number): void {
  const raw = text.slice(from, to);
  const leading = raw.length - raw.trimStart().length;
  const trailing = raw.length - raw.trimEnd().length;
  const start = from + leading;
  const end = to - trailing;

  if (start >= end) return;

  const sentenceText = text.slice(start, end);
  sentences.push({
    text: sentenceText,
    start,
    end,
    words: splitWords(sentenceText, start),
  });
}

/** Đếm số đoạn: mỗi dòng không rỗng là một đoạn. */
export function countParagraphs(text: string): number {
  return text.split(/\n+/).filter((block) => block.trim().length > 0).length;
}
