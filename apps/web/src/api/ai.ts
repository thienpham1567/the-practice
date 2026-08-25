import type { HighlightType } from "@writing-helper/analysis";
import { apiFetch, apiJson } from "./client";

/**
 * `"selection"` không phải một `HighlightType`: đó là request "sửa đoạn tôi
 * vừa chọn" mà người dùng bôi đen chủ động, không gắn với highlight nào.
 */
export type RewriteIssueType = HighlightType | "selection";

export interface RewriteInput {
  text: string;
  issueType: RewriteIssueType;
  context?: string;
}

export const getAiStatus = () => apiFetch<{ enabled: boolean }>("/ai/status");

export const requestRewrite = (input: RewriteInput) =>
  apiJson<{ suggestions: string[] }>("/ai/rewrite", "POST", input);
