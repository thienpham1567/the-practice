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
