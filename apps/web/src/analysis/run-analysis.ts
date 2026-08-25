import { analyze, type AnalysisResult } from "@writing-helper/analysis";

/**
 * Chạy phân tích, tự chọn chạy thẳng hay đẩy sang worker.
 *
 * Caller không cần biết ngưỡng hay worker: với văn bản thường, gọi thẳng vẫn
 * dưới một khung hình nên đẩy sang worker chỉ tổ thêm độ trễ; với bản thảo dài
 * thì ngược lại, chạy thẳng sẽ làm khựng lúc gõ.
 */

/** Khoảng 30 nghìn từ. Đếm ký tự cho rẻ, khỏi phải tách từ trước. */
const WORKER_THRESHOLD_CHARS = 150_000;

let worker: Worker | null = null;
let nextRequestId = 0;

function getWorker(): Worker {
  worker ??= new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

export function runAnalysis(text: string): Promise<AnalysisResult> {
  if (text.length < WORKER_THRESHOLD_CHARS || typeof Worker === "undefined") {
    return Promise.resolve(analyze(text));
  }

  const id = nextRequestId++;
  const active = getWorker();

  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent<{ id: number; result: AnalysisResult }>) => {
      if (event.data.id !== id) return;

      active.removeEventListener("message", onMessage);
      resolve(event.data.result);
    };

    active.addEventListener("message", onMessage);
    active.postMessage({ id, text });
  });
}
