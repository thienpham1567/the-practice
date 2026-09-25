import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/**
 * Bài viết được đưa nguyên vào prompt chấm AI. Không giới hạn thì một request
 * ~1 MB (giới hạn body) là ~250k token. 20 000 ký tự gấp ~10 lần một bài
 * opinion essay TOEIC (~300 từ).
 */
export const MAX_ESSAY_CHARS = 20_000;

const WRITING_TASK_TYPES = [
  "picture-sentence",
  "email-request",
  "opinion-essay",
] as const;

export class CreateAttemptDto {
  @IsIn(WRITING_TASK_TYPES)
  taskType!: (typeof WRITING_TASK_TYPES)[number];
}

export class UpdateAttemptDto {
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ESSAY_CHARS)
  plainText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  wordCount?: number;

  @IsOptional()
  @IsBoolean()
  hintsOpened?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  handledMarks?: string[];
}

export class SubmitAttemptDto {
  @IsObject()
  styleSnapshot!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ESSAY_CHARS)
  plainText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  wordCount?: number;
}
