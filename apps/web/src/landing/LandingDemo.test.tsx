import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LANDING_DEMO } from "../folio/landing-copy";
import { LandingDemo } from "./LandingDemo";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Chạy hết lịch diễn (mốc cuối 3600ms) rồi để React vẽ lại. */
function runSequence() {
  act(() => {
    vi.advanceTimersByTime(4000);
  });
}

describe("LandingDemo", () => {
  it("starts with the learner's own wording", () => {
    render(<LandingDemo />);

    expect(screen.getByText("will come")).toBeInTheDocument();
    expect(screen.getByText("three activity")).toBeInTheDocument();
    expect(screen.getByText("in weekend")).toBeInTheDocument();
  });

  it("holds the caption back until the sequence has run", () => {
    render(<LandingDemo />);

    expect(screen.queryByText(LANDING_DEMO.caption)).not.toBeInTheDocument();
  });

  it("ends with every mistake corrected", () => {
    render(<LandingDemo />);

    runSequence();

    expect(screen.getByText("are coming")).toBeInTheDocument();
    expect(screen.getByText("three activities")).toBeInTheDocument();
    expect(screen.getByText("at the weekend")).toBeInTheDocument();
    expect(screen.getByText(LANDING_DEMO.caption)).toBeInTheDocument();
  });

  it("marks each mistake before correcting it", () => {
    const { container } = render(<LandingDemo />);

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(container.querySelectorAll(".landing-mark.is-marked")).toHaveLength(3);
    // Vẫn chưa sửa: gạch chân phải hiện trước, nếu không thì không ai kịp thấy lỗi.
    expect(screen.getByText("will come")).toBeInTheDocument();
  });

  /** Hẹn giờ rò rỉ sẽ setState trên component đã gỡ và làm bẩn output test. */
  it("clears its timers when it goes away", () => {
    const { unmount } = render(<LandingDemo />);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  /* Khối demo có hai <p> (câu và dòng chốt), nên phải trỏ đích danh, không
     dùng getByRole("paragraph") — nó sẽ báo "multiple elements". */
  it("reads as one sentence, mistakes and all", () => {
    render(<LandingDemo />);

    expect(screen.getByTestId("demo-sentence")).toHaveTextContent(
      "I am very happy that you will come to my city. I want to suggest three activity we can do together in weekend.",
    );
  });

  /*
    is-marked là gạch lỗi (vermilion). Sửa xong mà vẫn giữ nguyên lớp đó thì
    chữ đã đúng vẫn đọc như là sai — phải chuyển sang is-fixed (dotted, discharged).
  */
  it("discharges the error mark once a phrase is corrected, not just clears it", () => {
    const { container } = render(<LandingDemo />);

    act(() => {
      vi.advanceTimersByTime(2900);
    });

    // Mốc sửa đầu tiên (2800ms) đã qua, hai mốc sau (2950, 3100) thì chưa.
    expect(screen.getByText("are coming")).toBeInTheDocument();
    expect(screen.queryByText("will come")).not.toBeInTheDocument();
    expect(screen.getByText("three activity")).toBeInTheDocument();

    expect(container.querySelectorAll(".landing-mark.is-fixed")).toHaveLength(1);
    expect(container.querySelectorAll(".landing-mark.is-marked")).toHaveLength(2);
  });

  /* Spec §5: ba chỗ sửa lệch nhau 150ms, không nhảy cùng lúc. */
  it("staggers the three corrections 150ms apart", () => {
    render(<LandingDemo />);

    act(() => {
      vi.advanceTimersByTime(2850);
    });
    expect(screen.getByText("are coming")).toBeInTheDocument();
    expect(screen.getByText("three activity")).toBeInTheDocument();
    expect(screen.getByText("in weekend")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByText("three activities")).toBeInTheDocument();
    expect(screen.getByText("in weekend")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByText("at the weekend")).toBeInTheDocument();
  });

  /* Spec: giảm chuyển động thì nhảy thẳng tới trạng thái cuối, không hẹn giờ gì. */
  it("jumps straight to the final state when the visitor asks for reduced motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    const { container } = render(<LandingDemo />);

    expect(screen.getByText("are coming")).toBeInTheDocument();
    expect(screen.getByText("three activities")).toBeInTheDocument();
    expect(screen.getByText("at the weekend")).toBeInTheDocument();
    expect(screen.getByText(LANDING_DEMO.caption)).toBeInTheDocument();
    expect(container.querySelectorAll(".landing-mark.is-fixed")).toHaveLength(3);
    expect(container.querySelectorAll(".landing-mark.is-marked")).toHaveLength(0);

    // Không còn gì hẹn giờ — nhảy thẳng, không diễn lịch nào cả.
    expect(vi.getTimerCount()).toBe(0);

    vi.unstubAllGlobals();
  });
});
