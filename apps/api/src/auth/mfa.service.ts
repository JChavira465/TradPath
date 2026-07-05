import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { authenticator } from "otplib";
import { decryptSecret, encryptSecret } from "../common/utils/crypto.util";

@Injectable()
export class MfaService {
  constructor(private readonly config: ConfigService) {}

  private get encryptionKey(): string {
    return this.config.get<string>("MFA_ENCRYPTION_KEY")!;
  }

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  encrypt(secret: string): string {
    return encryptSecret(secret, this.encryptionKey);
  }

  decrypt(encrypted: string): string {
    return decryptSecret(encrypted, this.encryptionKey);
  }

  keyUri(secret: string, email: string): string {
    return authenticator.keyuri(email, "TradPath", secret);
  }

  verify(code: string, encryptedSecret: string): boolean {
    const secret = this.decrypt(encryptedSecret);
    return authenticator.verify({ token: code, secret });
  }
}
