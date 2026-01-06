import { Platform } from '../platform/types.js';
import { TokenClaims, TokenScope } from './protocol.js';

export class TokenManager {
  constructor(
    private platform: Platform,
    private secret: string,
  ) {}

  /**
   * Mints a cryptographically signed token.
   * Format: header.payload.signature (Standard JWT)
   */
  async mint(scope: TokenScope, expiresInSeconds = 3600): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const claims: TokenClaims = {
      iat: now,
      exp: now + expiresInSeconds,
      scope,
    };

    const header = this.base64Url({ alg: 'HS256', typ: 'JWT' });
    const payload = this.base64Url(claims);
    const unsignedToken = `${header}.${payload}`;

    const signature = await this.platform.crypto.sign(
      unsignedToken,
      this.secret,
    );
    return `${unsignedToken}.${signature}`;
  }

  /**
   * Verifies a token and returns its claims if valid.
   * Throws errors for invalid signatures or expired tokens.
   */
  async verify(token: string): Promise<TokenClaims> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, payloadB64, signature] = parts;
    const unsignedToken = `${headerB64}.${payloadB64}`;

    // Cryptographic Check
    const isValid = await this.platform.crypto.verify(
      unsignedToken,
      signature,
      this.secret,
    );

    if (!isValid) {
      throw new Error('Invalid token signature');
    }

    // Decode & Expiration Check
    const claims = JSON.parse(
      this.platform.encoding.base64Decode(payloadB64),
    ) as TokenClaims;
    const now = Math.floor(Date.now() / 1000);

    if (claims.exp < now) {
      throw new Error('Token expired');
    }

    return claims;
  }

  private base64Url(obj: object): string {
    const str = JSON.stringify(obj);
    return this.platform.encoding.base64Encode(str);
  }
}
