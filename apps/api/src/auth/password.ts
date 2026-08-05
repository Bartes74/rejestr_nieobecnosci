import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Hasła: scrypt ze stdlib (bez natywnych zależności). Format "salt:hash".
// Wydzielone z auth.service, by LocalAuthProvider mógł je użyć bez cyklicznego importu.
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = scryptSync(plain, salt, 64);
  const orig = Buffer.from(hash, 'hex');
  return test.length === orig.length && timingSafeEqual(test, orig);
}
