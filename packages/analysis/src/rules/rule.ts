import type { Sentence } from "../tokenize.js";
import type { Highlight } from "../types.js";

/**
 * Internal seam của package: mọi rule đều nhận danh sách câu đã tách (kèm text
 * gốc cho các rule cần nhìn ngữ cảnh rộng hơn) và trả về highlight với offset
 * trên text gốc.
 *
 * Không export ra ngoài package — caller chỉ biết `analyze()`. Seam này tồn tại
 * để test từng rule độc lập và để thêm rule mới không phải sửa orchestrator.
 */
export type Rule = (sentences: Sentence[], text: string) => Highlight[];
