export interface DiffToken {
  text: string;
  changed: boolean;
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Đánh dấu từ nào trong `suggestion` khác so với `original`, dựa trên phần
 * chung dài nhất (LCS) theo từ. Dùng để tô nổi phần AI thật sự đã đổi thay vì
 * hiện cả câu như một khối không phân biệt được.
 */
export function diffWords(original: string, suggestion: string): DiffToken[] {
  const a = tokenize(original);
  const b = tokenize(suggestion);

  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i]![j] =
        a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const result: DiffToken[] = [];
  let i = 0;
  let j = 0;

  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) {
      result.push({ text: b[j]!, changed: false });
      i++;
      j++;
    } else if (i < a.length && dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i++;
    } else {
      result.push({ text: b[j]!, changed: true });
      j++;
    }
  }

  return result;
}
