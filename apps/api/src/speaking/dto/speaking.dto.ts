import { Type } from "class-transformer";
import { IsIn, IsInt, IsString, Max, Min } from "class-validator";

const LEVELS = ["A2", "B1", "B2", "C1"] as const;
const AUDIO_FORMATS = ["wav", "mp3"] as const;

export class CreateSpeakingAttemptDto {
  @IsIn(LEVELS)
  level!: (typeof LEVELS)[number];
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
