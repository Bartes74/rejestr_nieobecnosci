// Wspólne rusztowanie suit integracyjnych (verify-*.mjs).
//
// Każda suita zaczynała się od tych samych kilkunastu linii: adres API, klient Prismy, licznik
// porażek, `ok`, `j`, `login`, `as` i pętla czekania na `/health`. Trzynaście identycznych linii
// razy trzydzieści pięć plików — dopisanie nowej suity zaczynało się od skopiowania sąsiedniej,
// a poprawka w helperze siłą rzeczy dochodziła tylko tam, gdzie ktoś pamiętał zajrzeć.
//
// Suity, którym standardowy helper nie pasuje (inne nagłówki, logowanie zwracające `null`
// zamiast rzucać), zostawiają u siebie własną wersję i po prostu jej stąd nie importują.
import { PrismaClient } from '@prisma/client';

// Reeksport, żeby suita miała jedno źródło importu, a ścieżka do zbudowanego kodu stała
// w jednym miejscu zamiast w trzydziestu pięciu.
export { hashPassword } from './dist/auth/auth.service.js';

export const API = process.env.API ?? 'http://localhost:3100/api';
export const prisma = new PrismaClient();

/**
 * Licznik porażek. `export let` daje wiązanie żywe — suita robi `import { failures }` i widzi
 * aktualną wartość w swojej ostatniej linii, mimo że zwiększa ją `ok` tutaj.
 */
export let failures = 0;

/** Asercja: wypisuje wynik i podbija licznik. Wołana też wtedy, gdy warunek jest prawdziwy. */
export const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };

/** Odpowiedź jako JSON; kod inny niż 2xx kończy suitę wyjątkiem z treścią serwera. */
export const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };

/** Token sesji dla podanych poświadczeń. Rzuca, gdy logowanie się nie powiedzie. */
export const login = async (l, p) => (await j(await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: l, password: p }),
}))).token;

/** `fetch` w kontekście zalogowanej osoby: `as(token)('/absences', { method: 'POST', … })`. */
export const as = (t) => (p, o = {}) => fetch(API + p, {
  ...o, headers: { 'content-type': 'application/json', authorization: `Bearer ${t}`, ...(o.headers || {}) },
});

/**
 * Czeka, aż API zacznie odpowiadać — do 15 s. Suity startują zaraz po podniesieniu procesu
 * (także w CI), więc pierwsze żądanie trafiałoby w port, którego jeszcze nikt nie słucha.
 * Po wyczerpaniu prób wracamy bez błędu: niech padnie właściwa asercja z sensowną treścią,
 * a nie timeout rusztowania.
 */
export async function waitForApi() {
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch(`${API}/health`)).ok) return; } catch { /* jeszcze nie wstało */ }
    await new Promise((r) => setTimeout(r, 500));
  }
}
