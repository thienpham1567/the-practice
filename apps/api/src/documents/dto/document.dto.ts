import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  /** Lexical editor state. */
  @IsObject()
  content!: Record<string, unknown>;

  @IsString()
  plainText!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  grade?: number;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  plainText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  grade?: number;
}
