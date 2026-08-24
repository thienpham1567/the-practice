import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail({}, { message: "Email is not valid" })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(200)
  password!: string;
}

export class LoginDto {
  @IsEmail({}, { message: "Email is not valid" })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}
