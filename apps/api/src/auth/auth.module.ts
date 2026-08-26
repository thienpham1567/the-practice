import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GoogleTokenVerifier } from "./google-token-verifier";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { NonceService } from "./nonce.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    NonceService,
    { provide: OAuth2Client, useFactory: () => new OAuth2Client() },
    GoogleTokenVerifier,
  ],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
