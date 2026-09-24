import { createHmac, timingSafeEqual } from 'node:crypto';
import { UserRole } from '../../domain/models/User.js';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  restaurantId?: string;
  /** Narrow-purpose tokens (e.g. 'sse' for the EventSource stream). */
  scope?: string;
  /** Single-value issuer/audience claims: strict equality, prevents cross-context reuse. */
  iss?: string;
  aud?: string;
  /** Optional not-before; when present, tokens are rejected until it is reached. */
  nbf?: number;
  iat: number;
  exp: number;
}

/**
 * Public, well-known fallback used ONLY outside production (local dev/tests).
 * In production the server refuses to sign/verify with it (see getSecret).
 */
export const FALLBACK_DEV_SECRET = 'burger-page-secure-jwt-secret-key-change-in-prod';

const MAX_IAT_SKEW_SECONDS = 300;
const MAX_EXP_SKEW_SECONDS = 30;
const ISSUER = 'burger-page';
const AUDIENCE = 'burger-page-api';

export class JwtService {
  /**
   * Explicit override (tests/di wiring). When undefined, the secret is
   * resolved lazily from process.env.JWT_SECRET on every use, so the .env
   * loader (which runs after module imports in ESM) still applies.
   */
  private explicitSecret: string | undefined;

  constructor(secret?: string) {
    this.explicitSecret = secret;
  }

  private getSecret(): string {
    const secret = this.explicitSecret ?? process.env.JWT_SECRET;
    if (process.env.NODE_ENV === 'production' && (!secret || secret === FALLBACK_DEV_SECRET)) {
      throw new Error(
        'JWT_SECRET must be configured in production; refusing to use the insecure fallback secret.'
      );
    }
    return secret || FALLBACK_DEV_SECRET;
  }

  private base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf-8');
  }

  private sign(headerEncoded: string, payloadEncoded: string): string {
    return createHmac('sha256', this.getSecret())
      .update(`${headerEncoded}.${payloadEncoded}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  generateToken(
    user: { id: string; username: string; role: UserRole; restaurantId?: string; scope?: string },
    expiresInSeconds: number = 60 * 60 * 24 * 7 // 7 days
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      restaurantId: user.restaurantId,
      scope: user.scope,
      iss: ISSUER,
      aud: AUDIENCE,
      iat: now,
      exp: now + expiresInSeconds,
    };

    const headerEncoded = this.base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(headerEncoded, payloadEncoded);

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  verifyToken(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token structure');
    }

    const [headerEncoded, payloadEncoded, signatureProvided] = parts;
    const expectedSignature = this.sign(headerEncoded, payloadEncoded);

    const sigA = Buffer.from(signatureProvided);
    const sigB = Buffer.from(expectedSignature);

    if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) {
      throw new Error('Invalid token signature');
    }

    const header = JSON.parse(this.base64UrlDecode(headerEncoded)) as { alg?: string };
    if (header.alg !== 'HS256') {
      throw new Error('Unsupported token algorithm');
    }

    const payload = JSON.parse(this.base64UrlDecode(payloadEncoded)) as Partial<JwtPayload>;
    const now = Math.floor(Date.now() / 1000);

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Token is missing required sub claim');
    }
    if (payload.iss !== ISSUER) {
      throw new Error('Token issuer mismatch');
    }
    if (payload.aud !== AUDIENCE) {
      throw new Error('Token audience mismatch');
    }
    if (
      payload.nbf !== undefined &&
      typeof payload.nbf === 'number' &&
      Number.isFinite(payload.nbf) &&
      now + MAX_EXP_SKEW_SECONDS < payload.nbf
    ) {
      throw new Error('Token is not yet valid');
    }
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      throw new Error('Token is missing required exp claim');
    }
    if (payload.exp + MAX_EXP_SKEW_SECONDS < now) {
      throw new Error('Token has expired');
    }
    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat)) {
      throw new Error('Token is missing required iat claim');
    }
    if (payload.iat > now + MAX_IAT_SKEW_SECONDS) {
      throw new Error('Token iat is in the future');
    }

    return payload as JwtPayload;
  }
}