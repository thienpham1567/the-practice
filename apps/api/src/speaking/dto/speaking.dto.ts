import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const LEVELS = ["A2", "B1", "B2", "C1"] as const;
const SPEAKING_TASK_TYPES = [
  "read-aloud",
  "describe-picture",
  "respond-question",
  "respond-with-info",
  "express-opinion",
] as const;
const AUDIO_FORMATS = ["wav", "mp3"] as const;

export class CreateSpeakingAttemptDto {
  @IsIn(LEVELS)
  level!: (typeof LEVELS)[number];

  /** Optional until Task 8 makes taskType required and drops level. */
  @IsOptional()
  @IsIn(SPEAKING_TASK_TYPES)
  taskType?: (typeof SPEAKING_TASK_TYPES)[number];
}

export class UpdateSpeakingAttemptDto {
  @IsOptional()
  @IsBoolean()
  hintsOpened?: boolean;
}

export class SubmitSpeakingAttemptDto {
  @IsString()
  audioBase64!: string;

  @IsIn(AUDIO_FORMATS)
  format!: (typeof AUDIO_FORMATS)[number];

  @Type(() => Number)
  @IsInt()
  @Min(10_000)
  @Max(180_000)
  durationMs!: number;
}
