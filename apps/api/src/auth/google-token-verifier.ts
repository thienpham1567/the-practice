import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client } from "google-auth-library";

/**
 * Bọc `google-auth-library`: thư viện lo JWKS, chữ ký, iss/aud/exp.
 * Chi tiết lỗi chỉ vào log; client nhận thông báo chung.
 */
@Injectable()
export class GoogleTokenVerifier {
  private readonly logger = new Logger(GoogleTokenVerifier.name);

  constructor(
    private readonly config: ConfigService,
    private readonly oauthClient: OAuth2Client,
  ) {}

  async verify(idToken: string): Promise<{
    googleId: string;
    email: string;
    emailVerified: boolean;
    nonce?: string;
  }> {
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    if (!clientId) {
      throw new ServiceUnavailableException("Google sign-in is not configured");
    }

    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new Error("ID token payload missing sub or email");
      }

      return {
        googleId: payload.sub,
        email: payload.email.trim().toLowerCase(),
        emailVerified: Boolean(payload.email_verified),
        ...(payload.nonce ? { nonce: payload.nonce } : {}),
      };
    } catch (error) {
      this.logger.warn(
        `Google ID token verification failed: ${error instanceof Error ? error.message : error}`,
      );
      throw new UnauthorizedException("Invalid Google credential");
    }
  }
}
