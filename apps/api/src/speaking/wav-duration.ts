/**
 * Thời lượng thật của một file WAV PCM, đọc từ header (chunk `fmt ` + `data`).
 *
 * Server không tin `durationMs` client gửi: một WAV 8 kHz 8-bit tự dựng nằm gọn
 * trong giới hạn body nhưng dài vài phút, và mỗi giây audio là chi phí AI.
 * Trả về null nếu không phải WAV hợp lệ.
 */
export function wavDurationMs(bytes: Buffer): number | null {
  if (bytes.length < 12) return null;
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") {
    return null;
  }

  let byteRate = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const body = offset + 8;

    if (id === "fmt ") {
      if (size < 16 || body + 16 > bytes.length) return null;
      byteRate = bytes.readUInt32LE(body + 8);
    } else if (id === "data") {
      if (byteRate === 0) return null;
      // Header có thể khai size lớn hơn thực tế; chỉ tính phần có mặt.
      const present = Math.min(size, bytes.length - body);
      return Math.round((present / byteRate) * 1000);
    }

    // Chunk có độ dài lẻ được đệm 1 byte.
    offset = body + size + (size % 2);
  }
  return null;
}
