/**
 * Đề bài gồm hai phần: tình huống do model nghĩ ra, và khung yêu cầu cố định
 * của dạng bài. Khung được hiển thị thành một dòng riêng, nên phần thân chỉ nên
 * chứa tình huống.
 *
 * Những bài lưu trước đây nối sẵn khung vào cuối chuỗi — cắt nó ra ở đây để
 * khung không hiện hai lần.
 */
export function promptBody(prompt: string, instruction: string): string {
  const trimmed = prompt.trim();
  if (instruction === "" || !trimmed.endsWith(instruction)) return trimmed;

  return trimmed.slice(0, trimmed.length - instruction.length).trim();
}
