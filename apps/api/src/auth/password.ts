import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (p: string, s: string, len: number) => Promise<Buffer>;

// Hasła: scrypt ze stdlib (bez natywnych zależności). Format "salt:hash".
// Wydzielone z auth.service, by LocalAuthProvider mógł je użyć bez cyklicznego importu.
//
// Wersja synchroniczna zostaje: hasło ustawia administrator i seedy, więc liczy się raz na
// jakiś czas, a wywołania są w kontekście, w którym `await` byłby tylko hałasem (30 suit
// verify-*.mjs i prisma/seed.mjs budują nią pracowników w locie).
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Sprawdzenie hasła — asynchronicznie, bo to jedyne miejsce na ścieżce gorącej.
 *
 * scrypt jest kosztowny z założenia (to cały sens funkcji do haseł), a w wersji synchronicznej
 * blokuje pętlę zdarzeń: przez te ~100 ms proces nie obsługuje NICZEGO innego, więc logowanie
 * kilku osób naraz zatrzymuje całą aplikację, łącznie z sondą /health. Wersja asynchroniczna
 * liczy w puli wątków. Wywołujący jest jeden (LocalAuthProvider), więc zmiana jest lokalna.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = await scryptAsync(plain, salt, 64);
  const orig = Buffer.from(hash, 'hex');
  return test.length === orig.length && timingSafeEqual(test, orig);
}
