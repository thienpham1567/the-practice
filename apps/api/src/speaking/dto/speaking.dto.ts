import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const SPEAKING_TASK_TYPES = [
  "read-aloud",
  "describe-picture",
  "respond-question",
  "respond-with-info",
  "express-opinion",
] as const;
const AUDIO_FORMATS = ["wav", "mp3"] as const;
const SPEAK_SECONDS = [15, 30] as const;

export class CreateSpeakingAttemptDto {
  @IsIn(SPEAKING_TASK_TYPES)
  taskType!: (typeof SPEAKING_TASK_TYPES)[number];

  /** Only applied for respond-question / respond-with-info. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(SPEAK_SECONDS)
  speakSeconds?: (typeof SPEAK_SECONDS)[number];
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
  @Min(3_000)
  @Max(75_000)
  durationMs!: number;
}
