/**
 * Cả tooltip hover lẫn popover AI đều neo theo một điểm trong khung soạn thảo
 * và mặc định bung lên trên điểm đó. Khi điểm neo nằm quá gần đỉnh khung (ngay
 * dưới thanh toolbar), bung lên trên sẽ đẩy nội dung ra ngoài, khuất sau
 * toolbar — phải lật xuống dưới thay vào đó.
 */
export const FLIP_THRESHOLD_PX = 160;

export function shouldFlipBelow(anchorY: number): boolean {
  return anchorY < FLIP_THRESHOLD_PX;
}
