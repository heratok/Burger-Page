import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export class CryptoPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    const [salt, key] = hash.split(':');
    if (!salt || !key) return false;

    const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
    const keyBuffer = Buffer.from(key, 'hex');

    if (derivedKey.length !== keyBuffer.length) return false;
    return timingSafeEqual(derivedKey, keyBuffer);
  }
}
