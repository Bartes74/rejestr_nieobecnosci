// A6 — runner suit integracyjnych: czyści bazę i uruchamia wszystkie verify-*.mjs przeciw działającemu API.
// Wymaga uruchomionego API (API=... node apps/api/run-verify.mjs) z wykonanymi migracjami. Kod wyjścia ≠0 = porażka.
import { spawnSync } from 'node:child_process';

const dir = new URL('.', import.meta.url).pathname;
const run = (f) => spawnSync(process.execPath, [f], { cwd: dir, stdio: 'inherit', env: process.env }).status ?? 1;

// Kolejność jak w zweryfikowanych przebiegach (suity są niezależne — unikalne prefiksy loginów).
const SUITES = [
  'verify-krok1.mjs', 'verify-krok2.mjs', 'verify-krok3.mjs', 'verify-krok4.mjs', 'verify-krok5.mjs', 'verify-krok6.mjs',
  'verify-mvp-h4-j2.mjs', 'verify-faza2-niepelnedni.mjs', 'verify-faza2-zalega-lider.mjs', 'verify-faza2-email.mjs',
  'verify-faza2-l4-min.mjs', 'verify-faza2-proration.mjs', 'verify-faza2-b8.mjs', 'verify-faza2-i1.mjs', 'verify-faza2-f6.mjs',
  'verify-faza2-g7.mjs', 'verify-faza2-j3.mjs', 'verify-faza2-nfr.mjs', 'verify-faza3-zespol-import.mjs',
  'verify-faza3-scheduler.mjs', 'verify-faza3-bulk.mjs', 'verify-faza3-ical.mjs', 'verify-faza3-feed.mjs', 'verify-dlug-konfiguracja.mjs', 'verify-zakres-jednostek.mjs',
  'verify-l4-nakladka.mjs', 'verify-l4-forma-zatrudnienia.mjs', 'verify-pula-formy-swieta.mjs', 'verify-format-dat.mjs',
  'verify-b7-rolowanie.mjs',
  // Regresje po przeglądzie kodu — każda odtwarza konkretną lukę, nie funkcję.
  'verify-godziny-walidacja.mjs', 'verify-rodo-feedtoken.mjs', 'verify-sesja-uniewaznienie.mjs',
  'verify-przypomnienia-zalegle.mjs', 'verify-wyscig-puli.mjs',
  // Bez bazy i bez API — czysta funkcja wspólna dla obu importów .xlsx.
  'verify-xlsx-naglowki.mjs',
];

if (run('db-wipe.mjs') !== 0) { console.error('Czyszczenie bazy nie powiodło się.'); process.exit(1); }
const failed = [];
for (const f of SUITES) { if (run(f) !== 0) failed.push(f); }
console.log(failed.length ? `\n❌ NIEUDANE (${failed.length}): ${failed.join(', ')}` : `\n✅ Wszystkie ${SUITES.length} suit OK`);
process.exit(failed.length ? 1 : 0);
