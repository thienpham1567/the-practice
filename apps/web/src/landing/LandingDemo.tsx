import { useEffect, useState } from "react";
import { LANDING_DEMO } from "../folio/landing-copy";

/**
 * Lịch diễn, tính bằng ms từ lúc gắn vào DOM. Gạch chân phải hiện trước và giữ
 * đủ lâu để người xem kịp đọc chỗ sai — sửa ngay thì họ chỉ thấy chữ nhảy.
 */
const SCHEDULE = [
  { at: 1200, stage: 1 },
  { at: 1600, stage: 2 },
  { at: 2000, stage: 3 },
  { at: 2800, stage: 4 },
  { at: 3600, stage: 5 },
] as const;

const MARKED_AT_STAGE = [1, 2, 3];
const CORRECTED_STAGE = 4;
const CAPTION_STAGE = 5;

/**
 * Đoạn văn tự sửa ở hero — app làm gì, diễn trong bốn giây.
 *
 * Diễn một lần rồi giữ nguyên. Lặp vô hạn làm người ta không đọc nổi phần chữ
 * bên cạnh; trang tham chiếu cũng settle rồi đứng yên.
 */
export function LandingDemo() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = SCHEDULE.map((step) =>
      setTimeout(() => setStage(step.stage), step.at),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const corrected = stage >= CORRECTED_STAGE;

  return (
    <div className="landing-demo">
      <p data-testid="demo-sentence" className="font-display text-2xl leading-relaxed sm:text-3xl">
        {LANDING_DEMO.lead}{" "}
        {LANDING_DEMO.fixes.map((fix, index) => (
          <span key={fix.wrong}>
            <span
              className={`landing-mark ${stage >= MARKED_AT_STAGE[index]! ? "is-marked" : ""}`}
            >
              <span key={corrected ? "right" : "wrong"} className="animate-fade-up inline-block">
                {corrected ? fix.right : fix.wrong}
              </span>
            </span>
            {LANDING_DEMO.tail[index]}
          </span>
        ))}
      </p>
      <p
        className={`mt-6 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-vermilion transition-opacity duration-1000 ${
          stage >= CAPTION_STAGE ? "opacity-100" : "opacity-0"
        }`}
      >
        {stage >= CAPTION_STAGE ? LANDING_DEMO.caption : ""}
      </p>
    </div>
  );
}
