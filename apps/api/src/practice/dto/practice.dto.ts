import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

const LEVELS = ["A2", "B1", "B2", "C1"] as const;
const TASK_TYPES = [
  "email",
  "describe-experience",
  "letter",
  "review",
  "opinion-essay",
  "discussion-essay",
  "problem-solution",
  "report",
] as const;

export class CreateAttemptDto {
  @IsIn(LEVELS)
  level!: (typeof LEVELS)[number];

  @IsOptional()
  @IsIn(TASK_TYPES)
  taskType?: (typeof TASK_TYPES)[number];
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
