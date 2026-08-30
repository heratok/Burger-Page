import { createHmac, timingSafeEqual } from 'node:crypto';
import { UserRole } from '../../domain/models/User.js';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  restaurantId?: string;
  iat: number;
  exp: number;
}

export class JwtService {
  private secret: string;

  constructor(secret?: string) {
    this.secret = secret || process.env.JWT_SECRET || 'burger-page-secure-jwt-secret-key-change-in-prod';
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
    return createHmac('sha256', this.secret)
      .update(`${headerEncoded}.${payloadEncoded}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  generateToken(
    user: { id: string; username: string; role: UserRole; restaurantId?: string },
    expiresInSeconds: number = 60 * 60 * 24 * 7 // 7 days
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      restaurantId: user.restaurantId,
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

    const payload: JwtPayload = JSON.parse(this.base64UrlDecode(payloadEncoded));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      throw new Error('Token has expired');
    }

    return payload;
  }
}
