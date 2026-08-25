import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { HighlightType } from "@writing-helper/analysis";

/**
 * `"selection"` không đến từ `HighlightType` của package analysis — đó là
 * taxonomy của rule engine, còn đây là request "sửa đoạn tôi vừa chọn" mà
 * người dùng bôi đen chủ động, không gắn với một highlight cụ thể nào. AI
 * rewrite được phép có vốn từ rộng hơn rule engine một chút.
 */
export type RewriteIssueType = HighlightType | "selection";

const ISSUE_TYPES: RewriteIssueType[] = [
  "hard-sentence",
  "very-hard-sentence",
  "passive",
  "adverb",
  "qualifier",
  "complex-phrase",
  "selection",
];

export class RewriteDto {
  @IsString()
  @MaxLength(2000)
  text!: string;

  @IsIn(ISSUE_TYPES)
  issueType!: RewriteIssueType;

  /** Câu trước/sau, giúp mô hình hiểu mạch văn. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  context?: string;
}
