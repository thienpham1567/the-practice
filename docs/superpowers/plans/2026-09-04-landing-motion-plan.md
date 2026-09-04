# Landing page có chuyển động — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [../specs/2026-09-04-landing-motion-design.md](../specs/2026-09-04-landing-motion-design.md)

**Goal:** Dựng lại landing page theo nhịp của trang tham chiếu — hero toàn màn có một đoạn văn tự sửa trước mắt người xem, rồi bốn màn cuộn tới đâu hiện tới đó — mà không đổi một token màu hay font nào.

**Architecture:** Ba primitive CSS (`reveal-up`, `settle`, `reveal-lines`) kích hoạt bằng một class `in-view` do `IntersectionObserver` gắn vào. Không thêm dependency: `IntersectionObserver` là API sẵn của trình duyệt, và mọi chuyển động do CSS transition lo. Đây đúng là cơ chế trang tham chiếu dùng, chỉ lấy 3 primitive thay vì 8. Thời lượng 1.4–2.0s là chủ ý — nó là toàn bộ tính cách của nhịp này.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind v4 (`@theme` trong `index.css`), Vitest + Testing Library + jsdom.

## Global Constraints

- **Không đổi bất kỳ token nào trong khối `@theme`** của `apps/web/src/index.css`. Bản này thêm CSS mới, không sửa màu/font sẵn có.
- Không sửa trang nào khác, không sửa `apps/api`, không sửa `packages/*`.
- Mọi chuỗi hiển thị bằng **tiếng Anh** — repo có test chặn chuỗi tiếng Việt lọt vào UI. Chú thích code tiếng Việt là bình thường.
- **Không thêm dependency nào.**
- **`apps/web/src/pages/LandingPage.test.tsx` phải xanh nguyên trạng.** Không được sửa, nới lỏng, hay xoá một assertion nào trong đó. Nó ghim 9 chuỗi và 3 link; danh sách đầy đủ ở mục 8 của spec.
- Không lấy ảnh, font, hay câu chữ của trang tham chiếu.
- `jsdom` không có `IntersectionObserver` — test nào chạm tới nó phải tự stub.
- Sau mỗi task: chạy test liên quan, commit riêng.

---

### Task 1: Hook `useInView`

**Files:**
- Create: `apps/web/src/motion/use-in-view.ts`
- Create: `apps/web/src/motion/use-in-view.test.tsx`

**Interfaces:**
- Consumes: không.
- Produces: `useInView<T extends HTMLElement>(): RefObject<T | null>` — gắn class `in-view` vào phần tử một lần khi nó vào khung nhìn.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/motion/use-in-view.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInView } from "./use-in-view";

/** jsdom không có IntersectionObserver; dựng một cái điều khiển được bằng tay. */
let trigger: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
const disconnect = vi.fn();

beforeEach(() => {
  trigger = null;
  disconnect.mockClear();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        trigger = callback;
      }
      observe() {}
      disconnect = disconnect;
      unobserve() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe() {
  const ref = useInView<HTMLDivElement>();
  return <div ref={ref} data-testid="probe" />;
}

describe("useInView", () => {
  it("leaves the element alone until it enters the viewport", () => {
    const { getByTestId } = render(<Probe />);

    expect(getByTestId("probe").className).not.toContain("in-view");
  });

  it("adds in-view once the element intersects", () => {
    const { getByTestId } = render(<Probe />);

    trigger!([{ isIntersecting: true }]);

    expect(getByTestId("probe").className).toContain("in-view");
  });

  /** Vào lại mỗi lần cuộn qua lại gây chóng mặt; hiệu ứng chỉ chạy một lần. */
  it("stops observing after the first entry", () => {
    render(<Probe />);

    trigger!([{ isIntersecting: true }]);

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("ignores entries that are not intersecting", () => {
    const { getByTestId } = render(<Probe />);

    trigger!([{ isIntersecting: false }]);

    expect(getByTestId("probe").className).not.toContain("in-view");
    expect(disconnect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web test use-in-view`
Expected: FAIL — cannot resolve `./use-in-view`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/motion/use-in-view.ts`:

```ts
import { useEffect, useRef } from "react";

/**
 * Gắn class `in-view` vào phần tử một lần, khi nó vào khung nhìn. CSS lo phần
 * còn lại — đây là toàn bộ cơ chế của hệ chuyển động này, không có thư viện nào.
 *
 * Không gỡ class ra khi cuộn qua: hiệu ứng chạy lại mỗi lần cuộn lên xuống gây
 * chóng mặt và làm trang có cảm giác bồn chồn.
 */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Trình duyệt cổ hoặc môi trường test không stub: hiện luôn, đừng giấu nội dung.
    if (typeof IntersectionObserver === "undefined") {
      element.classList.add("in-view");
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      element.classList.add("in-view");
      observer.disconnect();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return ref;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @writing-helper/web test use-in-view`
Expected: PASS — 4 tests.

Lưu ý: test "stops observing after the first entry" đòi `disconnect` được gọi **đúng một lần**. Hàm dọn dẹp của `useEffect` cũng gọi `disconnect`, nhưng nó chỉ chạy lúc unmount, sau khi assertion đã xong — nên vẫn là 1.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/motion/use-in-view.ts apps/web/src/motion/use-in-view.test.tsx
git commit -m "Add useInView, the trigger for the landing motion system"
```

---

### Task 2: Ba primitive CSS

**Files:**
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Consumes: class `in-view` (Task 1).
- Produces: `--ease-settle`; class `.reveal-up`, `.settle`, `.reveal-lines` (với con `[data-line]` và biến `--line-index`); class `.landing-mark` cùng trạng thái `.is-marked`.

**Ghi chú về code sẵn có:** `index.css` mở đầu bằng `@import "tailwindcss";` rồi khối `@theme { ... }` chứa token màu/font/animate, kết thúc ở dòng `}` ngay trước `@keyframes fade-up`. **Không sửa gì bên trong `@theme`.** File đã có hai khối `@media (prefers-reduced-motion: reduce)`; thêm khối mới của bản này ngay sau CSS mới, đừng nhét vào khối cũ.

- [ ] **Step 1: Thêm CSS vào cuối `apps/web/src/index.css`**

```css
/*
 * Hệ chuyển động của landing page. Kích hoạt bằng class `in-view` do
 * `useInView` gắn vào — không thư viện animation nào.
 *
 * Thời lượng 1.4–2.0s là chủ ý, không phải nhầm. Animation web thường 200–400ms;
 * chính sự chậm này tạo cảm giác điềm tĩnh, "biên tập". Rút xuống 300ms là mất
 * sạch tính cách và thành một trang khác hẳn.
 */
:root {
  --ease-settle: cubic-bezier(0.43, 0.195, 0.02, 1);
}

.reveal-up {
  opacity: 0;
  transform: translateY(1.5rem);
}
.reveal-up.in-view,
.in-view .reveal-up {
  opacity: 1;
  transform: none;
  transition:
    opacity 1.4s var(--ease-settle),
    transform 1.4s var(--ease-settle);
  transition-delay: var(--reveal-delay, 0ms);
}

.settle {
  transform: scale(1.03);
}
.settle.in-view,
.in-view .settle {
  transform: scale(1);
  transition: transform 2s var(--ease-settle);
}

/* Chữ vào theo từng dòng. 70ms mỗi dòng — đo từ trang tham chiếu. */
.reveal-lines > [data-line] {
  opacity: 0;
  transform: translateY(0.6em);
}
.reveal-lines.in-view > [data-line],
.in-view .reveal-lines > [data-line] {
  opacity: 1;
  transform: none;
  transition:
    opacity 1.4s var(--ease-settle),
    transform 1.4s var(--ease-settle);
  transition-delay: calc(var(--line-index) * 70ms);
}

/*
 * Gạch chân lỗi tự vẽ từ trái sang. Không dùng ::highlight(wh-error) được:
 * CSS Custom Highlight API không animate, và cần JS Range để dựng.
 *
 * Màu son phải viết thẳng vào data URI (%23c14324) vì data URI không đọc được
 * biến CSS. Nếu --color-vermilion đổi, phải sửa cả ở đây.
 */
.landing-mark {
  position: relative;
  white-space: nowrap;
}
.landing-mark::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -3px;
  height: 3px;
  width: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 2 Q1.5 0 3 2 T6 2' fill='none' stroke='%23c14324' stroke-width='1'/%3E%3C/svg%3E");
  background-repeat: repeat-x;
  transition: width 0.7s var(--ease-settle);
}
.landing-mark.is-marked::after {
  width: 100%;
}

/* Đường band tự vẽ ở màn tiến bộ. */
.landing-trend-line {
  stroke-dasharray: var(--trend-length);
  stroke-dashoffset: var(--trend-length);
}
.in-view .landing-trend-line {
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 2s var(--ease-settle);
}

/*
 * Trang tham chiếu bỏ qua chỗ này — nó chỉ có 2 rule reduced-motion, không tắt
 * được primitive nào, nên phải bù bằng một toggle "Accessibility Mode" thủ công
 * ở góc màn hình. Làm đúng ở đây thì không cần cái toggle đó.
 */
@media (prefers-reduced-motion: reduce) {
  .reveal-up,
  .settle,
  .reveal-lines > [data-line],
  .landing-mark::after,
  .landing-trend-line {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }
  .landing-mark::after {
    width: 100%;
  }
  .landing-trend-line {
    stroke-dashoffset: 0;
  }
}
```

- [ ] **Step 2: Kiểm CSS build được**

Run: `pnpm --filter @writing-helper/web build`
Expected: build thành công, không cảnh báo CSS.

Không có test đơn vị cho CSS thuần — Task 6 kiểm bằng mắt trên trình duyệt, và mục "Step 4" của nó kiểm cả trạng thái giảm chuyển động.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/index.css
git commit -m "Add the landing motion primitives and their reduced-motion fallback"
```

---

### Task 3: Component `RevealLines`

**Files:**
- Create: `apps/web/src/motion/RevealLines.tsx`
- Create: `apps/web/src/motion/RevealLines.test.tsx`

**Interfaces:**
- Consumes: `useInView` (Task 1); class `.reveal-lines` (Task 2).
- Produces: `<RevealLines lines={string[]} className?={string} as?={"h1" | "h2" | "p"} />`

**Vì sao tách dòng thủ công qua props:** đo chiều rộng lúc chạy để tự ngắt dòng thì phức tạp và gây nhảy layout. Người viết trang tự quyết ngắt ở đâu.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/motion/RevealLines.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RevealLines } from "./RevealLines";

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

describe("RevealLines", () => {
  /*
    Đây là điều dễ làm sai nhất khi tách dòng để animate: máy đọc màn hình đọc
    ra từng mảnh rời rạc. Câu gốc phải còn nguyên một khối trong DOM.
  */
  it("keeps the whole sentence readable as one string", () => {
    render(<RevealLines lines={["Sit the paper.", "Take the turn."]} />);

    expect(screen.getByText("Sit the paper. Take the turn.")).toBeInTheDocument();
  });

  it("hides the split copy from assistive tech", () => {
    const { container } = render(<RevealLines lines={["one", "two"]} />);

    const split = container.querySelector(".reveal-lines");
    expect(split?.getAttribute("aria-hidden")).toBe("true");
  });

  it("numbers the lines so they can be staggered", () => {
    const { container } = render(<RevealLines lines={["one", "two", "three"]} />);

    const lines = [...container.querySelectorAll("[data-line]")];
    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.getAttribute("style"))).toEqual([
      "--line-index: 0;",
      "--line-index: 1;",
      "--line-index: 2;",
    ]);
  });

  it("renders as the requested element", () => {
    render(<RevealLines as="h1" lines={["headline"]} />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web test RevealLines`
Expected: FAIL — cannot resolve `./RevealLines`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/motion/RevealLines.tsx`:

```tsx
import type { CSSProperties } from "react";
import { useInView } from "./use-in-view";

/**
 * Chữ vào theo từng dòng, lệch nhau 70ms.
 *
 * Câu gốc giữ nguyên một khối trong `.sr-only` cho máy đọc màn hình; bản tách
 * dòng để animate thì `aria-hidden`. Bỏ qua chỗ này là máy đọc phát ra từng
 * mảnh rời rạc — lỗi mà phần lớn hiệu ứng kiểu này mắc phải.
 */
export function RevealLines({
  lines,
  className = "",
  as: Tag = "p",
}: {
  lines: string[];
  className?: string;
  as?: "h1" | "h2" | "p";
}) {
  const ref = useInView<HTMLElement>();

  return (
    <Tag ref={ref as never} className={className}>
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden="true" className="reveal-lines block">
        {lines.map((line, index) => (
          <span
            key={line}
            data-line
            className="block"
            style={{ "--line-index": index } as CSSProperties}
          >
            {line}
          </span>
        ))}
      </span>
    </Tag>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @writing-helper/web test RevealLines`
Expected: PASS — 4 tests.

Nếu test `--line-index` đỏ vì React render style khác định dạng mong đợi, **sửa assertion cho khớp định dạng thật, đừng bỏ assertion** — điều cần chốt là mỗi dòng mang chỉ số riêng tăng dần.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/motion/RevealLines.tsx apps/web/src/motion/RevealLines.test.tsx
git commit -m "Add RevealLines: staggered lines that screen readers still read whole"
```

---

### Task 4: Nội dung mới và khối demo hero

**Files:**
- Modify: `apps/web/src/folio/landing-copy.ts`
- Create: `apps/web/src/landing/LandingDemo.tsx`
- Create: `apps/web/src/landing/LandingDemo.test.tsx`

**Interfaces:**
- Consumes: class `.landing-mark` / `.is-marked` (Task 2).
- Produces: hằng `LANDING_DEMO`, `LANDING_MISTAKES`, `LANDING_TREND` trong `landing-copy.ts`; component `<LandingDemo />` không nhận prop.

**Ghi chú về code sẵn có:** `landing-copy.ts` đã export `LANDING_HEADLINE`, `LANDING_LEDE`, `LANDING_PAPER`, `LANDING_TALK` và import `TASK_CATALOG`. **Giữ nguyên cả bốn** — test cũ ghim nội dung của chúng. Chỉ thêm vào cuối file.

- [ ] **Step 1: Thêm hằng vào cuối `apps/web/src/folio/landing-copy.ts`**

```ts
/**
 * Đoạn văn diễn ở hero. Ba lỗi này không bịa: chúng nằm trong nhóm năm lỗi mà
 * model tìm thấy 5/5 lần với nhãn nhất quán tuyệt đối, đo được ở
 * docs/superpowers/specs/2026-09-02-grading-variance-measurement.md mục 3.
 * Nhãn khớp MARK_LABELS trong packages/practice/src/mark-catalog.ts.
 */
export const LANDING_DEMO = {
  lead: "I am very happy that you",
  fixes: [
    { wrong: "will come", right: "are coming", label: "Verb tense" },
    { wrong: "three activity", right: "three activities", label: "Singular / plural" },
    { wrong: "in weekend", right: "at the weekend", label: "Prepositions" },
  ],
  tail: [" to my city. I want to suggest ", " we can do together ", "."],
  caption: "3 mistakes · marked",
} as const;

/** Minh hoạ sổ lỗi. Hằng, không gọi API: landing là trang công khai. */
export const LANDING_MISTAKES = {
  kicker: "Your notebook",
  lines: ["The same mistakes", "stop hiding after a week."],
  tallies: [
    { label: "Articles", count: 7 },
    { label: "Verb tense", count: 5 },
    { label: "Prepositions", count: 4 },
  ],
} as const;

/** Minh hoạ biểu đồ band. Cũng là hằng, cùng lý do. */
export const LANDING_TREND = {
  kicker: "Eight weeks",
  lines: ["A band is one paper.", "A line is a habit."],
  bands: [5, 5.5, 5.5, 6, 6, 6.5, 6.5, 7],
} as const;
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/landing/LandingDemo.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LANDING_DEMO } from "../folio/landing-copy";
import { LandingDemo } from "./LandingDemo";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
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

    expect(() => vi.advanceTimersByTime(4000)).not.toThrow();
  });

  /* Khối demo có hai <p> (câu và dòng chốt), nên phải trỏ đích danh, không
     dùng getByRole("paragraph") — nó sẽ báo "multiple elements". */
  it("reads as one sentence, mistakes and all", () => {
    render(<LandingDemo />);

    expect(screen.getByTestId("demo-sentence")).toHaveTextContent(
      "I am very happy that you will come to my city. I want to suggest three activity we can do together in weekend.",
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web test LandingDemo`
Expected: FAIL — cannot resolve `./LandingDemo`.

- [ ] **Step 4: Write the implementation**

Create `apps/web/src/landing/LandingDemo.tsx`:

```tsx
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
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @writing-helper/web test LandingDemo && pnpm --filter @writing-helper/web typecheck`
Expected: PASS — 6 tests; typecheck sạch.

Nếu test "reads as one sentence" đỏ vì khoảng trắng, sửa **chuỗi `tail` trong `landing-copy.ts`** cho câu ghép lại đúng — đừng nới lỏng assertion. Câu đích:
`"I am very happy that you will come to my city. I want to suggest three activity we can do together in weekend."`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/folio/landing-copy.ts apps/web/src/landing/LandingDemo.tsx apps/web/src/landing/LandingDemo.test.tsx
git commit -m "Add the hero demo: a paper marking itself in four seconds"
```

---

### Task 5: Dựng lại `LandingPage`

**Files:**
- Modify: `apps/web/src/pages/LandingPage.tsx`
- Create: `apps/web/src/pages/LandingPage.motion.test.tsx`

**Interfaces:**
- Consumes: `useInView` (Task 1), `RevealLines` (Task 3), `LandingDemo` + ba hằng mới (Task 4), CSS (Task 2).
- Produces: không có API mới cho task sau.

**Ghi chú về code sẵn có:** `LandingPage` hiện nhận prop `now?: Date`, render `<PageAtmosphere kind="folio" />`, `<Masthead>` với `folioDateline(now)`, headline, lede, hai `<article>` thẻ đề, rồi CTA. **Giữ toàn bộ những phần tử đó** — test cũ ghim chúng, kể cả dateline (tức `<Masthead>` bắt buộc còn).

**Ràng buộc lớn nhất của task này:** `apps/web/src/pages/LandingPage.test.tsx` **phải xanh mà không sửa một ký tự nào**. Nếu nó đỏ, sửa trang cho khớp lại, đừng sửa test.

- [ ] **Step 1: Viết test hồi quy cho phần chuyển động**

Create `apps/web/src/pages/LandingPage.motion.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LANDING_MISTAKES, LANDING_TREND } from "../folio/landing-copy";
import { LandingPage } from "./LandingPage";

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage now={new Date(2026, 7, 26)} />
    </MemoryRouter>,
  );
}

describe("LandingPage motion sections", () => {
  it("opens with the paper marking itself", () => {
    renderPage();

    expect(screen.getByText("will come")).toBeInTheDocument();
  });

  it("shows the mistake notebook tallies", () => {
    renderPage();

    for (const tally of LANDING_MISTAKES.tallies) {
      expect(screen.getByText(tally.label)).toBeInTheDocument();
    }
  });

  it("draws the band trend as a real polyline, not an image", () => {
    const { container } = renderPage();

    const line = container.querySelector("polyline.landing-trend-line");
    expect(line).not.toBeNull();
    expect(line!.getAttribute("points")!.split(" ")).toHaveLength(
      LANDING_TREND.bands.length,
    );
  });

  /*
    Nội dung phải có mặt trong DOM bất kể IntersectionObserver có bắn hay không.
    Nếu render nội dung theo state của observer thì máy tìm kiếm và người tắt JS
    thấy một trang trống.
  */
  it("puts every section in the DOM before anything scrolls into view", () => {
    renderPage();

    expect(screen.getByText(LANDING_MISTAKES.kicker)).toBeInTheDocument();
    expect(screen.getByText(LANDING_TREND.kicker)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web test LandingPage.motion`
Expected: FAIL — chưa có mục nào trong số đó.

- [ ] **Step 3: Dựng lại trang**

Thay toàn bộ `apps/web/src/pages/LandingPage.tsx` bằng:

```tsx
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { AppMark } from "../AppMark";
import { folioDateline } from "../folio/folio-dateline";
import {
  LANDING_DEMO,
  LANDING_LEDE,
  LANDING_MISTAKES,
  LANDING_PAPER,
  LANDING_TALK,
  LANDING_TREND,
} from "../folio/landing-copy";
import { Masthead } from "../folio/Masthead";
import { PageAtmosphere } from "../folio/PageAtmosphere";
import { LandingDemo } from "../landing/LandingDemo";
import { RevealLines } from "../motion/RevealLines";
import { useInView } from "../motion/use-in-view";

/*
  LANDING_HEADLINE ngắt làm hai dòng. `join(" ")` trong RevealLines phải dựng
  lại đúng nguyên văn hằng đó, kể cả dấu chấm — test cũ ghim chuỗi đầy đủ.
*/
const HEADLINE_LINES = ["Sit the paper.", "Take the turn."];

/** Đường band, vẽ trong hệ toạ độ 100×40 rồi để SVG co giãn. */
function trendPoints(bands: readonly number[]): string {
  const low = Math.min(...bands);
  const high = Math.max(...bands);
  const span = high - low || 1;
  return bands
    .map((band, index) => {
      const x = (index / (bands.length - 1)) * 100;
      const y = 40 - ((band - low) / span) * 40;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function LandingPage({ now = new Date() }: { now?: Date }) {
  const tasksRef = useInView<HTMLElement>();
  const mistakesRef = useInView<HTMLElement>();
  const trendRef = useInView<HTMLElement>();
  const ctaRef = useInView<HTMLElement>();

  return (
    <main className="relative">
      <PageAtmosphere kind="folio" />

      <div className="mx-auto max-w-3xl px-6 pt-14">
        <div className="animate-fade-up">
          <Masthead>
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
              {folioDateline(now)}
            </p>
          </Masthead>
        </div>
      </div>

      {/* Hero: min-h chứ không h, để màn ngang thấp vẫn cuộn tới CTA được. */}
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20">
        <RevealLines
          as="h1"
          lines={HEADLINE_LINES}
          className="font-display text-5xl font-semibold tracking-tight sm:text-6xl"
        />
        <p className="mt-6 max-w-xl text-lg text-ink-soft">{LANDING_LEDE}</p>

        <div className="mt-16 border-t border-rule pt-10">
          <LandingDemo />
        </div>
      </section>

      <section ref={tasksRef} className="mx-auto max-w-3xl px-6 py-32">
        <article className="reveal-up relative overflow-hidden border border-rule px-5 py-8 sm:px-8 sm:py-10">
          <AppMark className="pointer-events-none absolute -right-2 -top-2 h-12 w-12 -rotate-6 text-vermilion sm:-right-3 sm:-top-3 sm:h-14 sm:w-14" />
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
            {LANDING_PAPER.kicker}
          </p>
          <p className="mt-4 text-ink-soft">{LANDING_PAPER.instruction}</p>
          <p className="mt-4 font-display text-xl leading-snug">{LANDING_PAPER.prompt}</p>
        </article>

        <article
          className="reveal-up relative mt-4 overflow-hidden border border-rule px-5 py-8 sm:px-8 sm:py-10"
          style={{ "--reveal-delay": "120ms" } as CSSProperties}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-1 -top-4 font-display text-7xl leading-none text-vermilion/25 sm:-right-2 sm:-top-5 sm:text-8xl"
          >
            &ldquo;
          </span>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
            {LANDING_TALK.kicker}
          </p>
          <p className="mt-4 text-ink-soft">{LANDING_TALK.instruction}</p>
          <p className="mt-4 font-display text-xl leading-snug">{LANDING_TALK.prompt}</p>
        </article>
      </section>

      <section ref={mistakesRef} className="mx-auto max-w-3xl px-6 py-32">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          {LANDING_MISTAKES.kicker}
        </p>
        <RevealLines
          as="h2"
          lines={[...LANDING_MISTAKES.lines]}
          className="mt-4 font-display text-3xl leading-tight sm:text-4xl"
        />
        <ul className="mt-10 space-y-3">
          {LANDING_MISTAKES.tallies.map((tally, index) => (
            <li
              key={tally.label}
              className="reveal-up flex items-baseline justify-between border-b border-rule pb-2"
              style={{ "--reveal-delay": `${index * 120}ms` } as CSSProperties}
            >
              <span className="font-display text-lg">{tally.label}</span>
              <span className="font-mono text-sm tabular-nums text-vermilion">
                &times;{tally.count}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section ref={trendRef} className="mx-auto max-w-3xl px-6 py-32">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          {LANDING_TREND.kicker}
        </p>
        <RevealLines
          as="h2"
          lines={[...LANDING_TREND.lines]}
          className="mt-4 font-display text-3xl leading-tight sm:text-4xl"
        />
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          role="img"
          aria-label="Band scores rising over eight weeks"
          className="mt-10 h-32 w-full"
        >
          <polyline
            className="landing-trend-line"
            points={trendPoints(LANDING_TREND.bands)}
            fill="none"
            stroke="var(--color-vermilion)"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
            style={{ "--trend-length": 400 } as CSSProperties}
          />
        </svg>
      </section>

      <section ref={ctaRef} className="mx-auto max-w-3xl px-6 pb-32">
        <div className="reveal-up flex flex-wrap items-baseline gap-x-6 gap-y-3">
          <Link
            to="/register"
            className="bg-ink px-5 py-2 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-vermilion"
          >
            Begin practice
          </Link>
          <Link
            to="/write"
            className="text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline"
          >
            Open a draft
          </Link>
        </div>
        <p
          className="reveal-up mt-6 text-sm text-ink-soft"
          style={{ "--reveal-delay": "120ms" } as CSSProperties}
        >
          Already have an account?{" "}
          <Link to="/login" className="text-vermilion underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
```

Ba điểm dễ làm hỏng:

1. `HEADLINE_LINES.join(" ")` **phải** bằng đúng `LANDING_HEADLINE`. Test cũ ghim chuỗi đầy đủ; ngắt sai chỗ là nó đỏ, và đó là tín hiệu đúng.
2. `[...LANDING_MISTAKES.lines]` — hằng khai báo `as const` nên là mảng readonly; `RevealLines` nhận `string[]`, phải sao chép ra.
3. `trendPoints` nối bằng **một** dấu cách và không có dấu cách thừa ở đầu/cuối — test đếm `points.split(" ").length` bằng số band.

- [ ] **Step 4: Chạy cả hai file test của trang**

Run: `pnpm --filter @writing-helper/web test LandingPage`
Expected: PASS cả `LandingPage.test.tsx` (cũ, không sửa) lẫn `LandingPage.motion.test.tsx`.

Nếu test cũ đỏ: **sửa trang**, không sửa test. Nguyên nhân hay gặp nhất là ngắt dòng headline làm `lines.join(" ")` không dựng lại đúng nguyên văn.

- [ ] **Step 5: Chạy toàn bộ web và typecheck**

Run: `pnpm --filter @writing-helper/web test && pnpm --filter @writing-helper/web typecheck`
Expected: PASS, typecheck sạch.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/LandingPage.tsx apps/web/src/pages/LandingPage.motion.test.tsx
git commit -m "Rebuild the landing page around the motion system"
```

---

### Task 6: Kiểm chứng trên trình duyệt

**Files:** không sửa file nào.

**Interfaces:**
- Consumes: Task 1–5.
- Produces: không.

- [ ] **Step 1: Chạy tất cả**

Run: `pnpm test && pnpm lint`
Expected: toàn bộ suite xanh, lint sạch.

Nếu `apps/api` e2e đỏ vì không nối được database: chạy `docker start writing-helper-db` (khởi động OrbStack trước nếu cần) rồi chạy lại. Đó không phải lỗi của bản này.

- [ ] **Step 2: Mở app**

Mở preview qua launch config `writing-helper`, vào `/` khi **chưa đăng nhập**.

- [ ] **Step 3: Xem hero diễn**

Tải lại trang và nhìn suốt bốn giây đầu:
- Đoạn văn hiện ra
- Ba gạch chân đỏ son **vẽ từ trái sang**, lệch nhau, không hiện cùng lúc
- Rồi ba chỗ sai đổi thành câu đúng
- Rồi dòng `3 mistakes · marked` hiện
- **Rồi dừng hẳn** — không lặp lại

- [ ] **Step 4: Kiểm giảm chuyển động**

Đặt `colorScheme` không liên quan; dùng công cụ để giả lập `prefers-reduced-motion: reduce`, tải lại trang.

Xác nhận: mọi nội dung hiện **đầy đủ và ngay lập tức**, gạch chân đã ở trạng thái vẽ xong, đường band đã vẽ xong, không có gì trượt hay mờ dần. Đây là điều trang tham chiếu làm sai và ta làm đúng.

- [ ] **Step 5: Cuộn xuống**

Từng mục hiện khi vào khung nhìn, không phải tất cả cùng lúc. Cuộn lên rồi xuống lại: **không diễn lại**.

- [ ] **Step 6: Kiểm màn hẹp**

Đặt viewport 375×812. Xác nhận không có cuộn ngang (`document.body.scrollWidth <= window.innerWidth`), đoạn demo không vỡ, CTA vẫn tới được.

- [ ] **Step 7: Báo cáo**

Ghi lại quan sát kèm ảnh chụp hero và một mục cuộn. Có gì lệch spec thì báo, đừng tự sửa ngoài phạm vi.

---

## Rủi ro cần theo dõi

- **`white-space: nowrap` trên `.landing-mark`** giữ cụm lỗi không bị ngắt đôi, nhưng ở màn rất hẹp có thể đẩy tràn. Kiểm ở 375px (Task 6 Step 6).
- **Màu son trong data URI** viết cứng `%23c14324`; nếu ai đổi `--color-vermilion` thì gạch chân sẽ lệch màu. Đã ghi chú ngay tại chỗ trong CSS.
- **Hero `min-h-screen` trên điện thoại xoay ngang** có thể cao hơn màn; dùng `min-h-screen` chứ không `h-screen` nên nội dung vẫn cuộn tới được.
