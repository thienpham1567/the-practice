import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const SPEAKING_TASK_TYPES = [
  "read-aloud",
  "describe-picture",
  "respond-question",
  "respond-with-info",
  "express-opinion",
] as const;
/**
 * Chỉ WAV: server đọc được thời lượng thật từ header (xem wav-duration.ts).
 * MP3 bitrate thấp nhét hàng chục phút vào vài MB mà không kiểm được rẻ.
 */
const AUDIO_FORMATS = ["wav"] as const;
/** Giây nói dài nhất server chấp nhận (tối đa 75 s + 1 s dư). */
export const MAX_AUDIO_MS = 76_000;
/** WAV 16 kHz mono 16-bit mà web ghi: 32 000 B/s → 76 s ≈ 2,43 MB ≈ 3,24 MB base64. */
const MAX_AUDIO_BASE64_CHARS = 3_300_000;
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
  @MaxLength(MAX_AUDIO_BASE64_CHARS)
  audioBase64!: string;

  @IsIn(AUDIO_FORMATS)
  format!: (typeof AUDIO_FORMATS)[number];

  @Type(() => Number)
  @IsInt()
  @Min(3_000)
  @Max(75_000)
  durationMs!: number;
}
