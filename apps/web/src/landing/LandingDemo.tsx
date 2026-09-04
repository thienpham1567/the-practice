import { useEffect, useState } from "react";
import { LANDING_DEMO } from "../folio/landing-copy";

/**
 * Lịch diễn, tính bằng ms từ lúc gắn vào DOM. Gạch chân phải hiện trước và giữ
 * đủ lâu để người xem kịp đọc chỗ sai — sửa ngay thì họ chỉ thấy chữ nhảy.
 *
 * Sinh lịch từ `LANDING_DEMO.fixes.length` thay vì liệt kê từng mốc: thêm một
 * lỗi thứ tư vào landing-copy chỉ cần đúng số phrase, không phải nhớ sửa ba
 * hằng riêng biệt ăn khớp với nhau.
 */
const MARK_START_MS = 1200;
const MARK_STEP_MS = 400;
const CORRECT_START_MS = 2800;
const CORRECT_STEP_MS = 150; // mỗi chỗ sửa lệch nhau 150ms, không sửa đồng loạt
const CAPTION_AT_MS = 3600;

function reducedMotionRequested(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Đoạn văn tự sửa ở hero — app làm gì, diễn trong bốn giây.
 *
 * Diễn một lần rồi giữ nguyên. Lặp vô hạn làm người ta không đọc nổi phần chữ
 * bên cạnh; trang tham chiếu cũng settle rồi đứng yên.
 *
 * Giảm chuyển động: nhảy thẳng tới trạng thái cuối, không hẹn giờ gì cả — đây
 * là nội dung chính của trang, không phải hiệu ứng trang trí có thể bỏ qua.
 */
export function LandingDemo() {
  const count = LANDING_DEMO.fixes.length;
  const [marked, setMarked] = useState<boolean[]>(() => Array(count).fill(false));
  const [corrected, setCorrected] = useState<boolean[]>(() => Array(count).fill(false));
  const [showCaption, setShowCaption] = useState(false);

  useEffect(() => {
    if (reducedMotionRequested()) {
      setMarked(Array(count).fill(true));
      setCorrected(Array(count).fill(true));
      setShowCaption(true);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let index = 0; index < count; index += 1) {
      timers.push(
        setTimeout(() => {
          setMarked((prev) => prev.map((value, i) => (i === index ? true : value)));
        }, MARK_START_MS + index * MARK_STEP_MS),
      );
      timers.push(
        setTimeout(() => {
          setCorrected((prev) => prev.map((value, i) => (i === index ? true : value)));
        }, CORRECT_START_MS + index * CORRECT_STEP_MS),
      );
    }
    timers.push(setTimeout(() => setShowCaption(true), CAPTION_AT_MS));

    return () => timers.forEach(clearTimeout);
  }, [count]);

  return (
    <div className="landing-demo">
      <p data-testid="demo-sentence" className="font-display text-2xl leading-relaxed sm:text-3xl">
        {LANDING_DEMO.lead}{" "}
        {LANDING_DEMO.fixes.map((fix, index) => (
          <span key={fix.wrong}>
            <span
              className={`landing-mark ${
                corrected[index] ? "is-fixed" : marked[index] ? "is-marked" : ""
              }`}
            >
              <span
                key={corrected[index] ? "right" : "wrong"}
                className="animate-fade-up inline-block"
              >
                {corrected[index] ? fix.right : fix.wrong}
              </span>
            </span>
            {LANDING_DEMO.tail[index]}
          </span>
        ))}
      </p>
      <p
        className={`mt-6 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-vermilion transition-opacity duration-1000 ${
          showCaption ? "opacity-100" : "opacity-0"
        }`}
      >
        {showCaption ? LANDING_DEMO.caption : ""}
      </p>
    </div>
  );
}
