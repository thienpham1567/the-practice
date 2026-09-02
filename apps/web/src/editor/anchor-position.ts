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

/**
 * Thẻ neo theo điểm bấm và canh giữa, nên mỗi bên thò ra nửa chiều rộng. Trên
 * màn 375px, thẻ 288px cần 144px chừa hai bên — phần lớn dòng chữ nằm gần mép
 * hơn thế, nên thẻ bị đẩy ra ngoài màn hình. Kéo điểm neo vào trong để thẻ luôn
 * nằm trọn trong khung.
 *
 * Khung hẹp hơn cả thẻ thì không cách nào giữ trọn được: canh giữa để chia đều
 * phần tràn, thay vì giấu hẳn một bên.
 */
export function clampAnchorX(anchorX: number, containerWidth: number, cardWidth: number): number {
  const half = cardWidth / 2;
  if (containerWidth < cardWidth) return containerWidth / 2;
  return Math.min(Math.max(anchorX, half), containerWidth - half);
}
