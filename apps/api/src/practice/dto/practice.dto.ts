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
  Min,
} from "class-validator";

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
  plainText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  wordCount?: number;
}
