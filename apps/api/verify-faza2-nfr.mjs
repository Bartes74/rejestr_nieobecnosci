// Faza 2: NFR-2 (sonda health/monitoring) + NFR-8 (analityka adopcji) + NFR-5/A1 (fail-fast sekretów).
import { API, as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';
import { spawnSync } from 'node:child_process';

await waitForApi();

// NFR-2 — sonda dostępności
const h = await j(await fetch(`${API}/health`));
ok(h.status === 'ok' && h.db === 'ok' && typeof h.uptimeSec === 'number' && h.version, 'NFR-2: /health zwraca status, db, uptime, version');

// dane do analityki: pracownik loguje się i robi wpis
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop NFR' } });
const mk = (login, role) => prisma.employee.create({ data: { firstName: login, lastName: 'NFR', email: `${login}@x.pl`, login, role, employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const admin = await mk('nfradmin', 'ADMIN');
const anna = await mk('nfranna', 'EMPLOYEE');
const aAnna = as(await login('nfranna', 'haslo123'));
await j(await aAnna('/absences', { method: 'POST', body: JSON.stringify({ employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-06-08', dateTo: '2026-06-08' }) }));

// NFR-8 — analityka adopcji
const aAdmin = as(await login('nfradmin', 'haslo123'));
const m = await j(await aAdmin('/analytics/adoption'));
ok(typeof m.adoptionRate === 'number' && m.kpiTarget === 80 && m.totalEmployees >= 2, 'NFR-8: adopcja policzona (rate, kpi 80, liczba pracowników)');
ok(m.logins >= 2 && m.absencesCreated >= 1 && m.activeUsers >= 1, 'NFR-8: logowania, wpisy i aktywni użytkownicy zliczeni z audytu');
ok((await as(await login('nfranna', 'haslo123'))('/analytics/adoption')).status === 403, 'pracownik nie ma dostępu do analityki → 403');

// NFR-5 / A1 — w produkcji brak wymaganych sekretów zatrzymuje start (fail-fast, bez niebezpiecznych domyślnych).
const ff = spawnSync(process.execPath, ['dist/main.js'], {
  cwd: new URL('.', import.meta.url).pathname,
  env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: '', DATABASE_URL: '' },
  encoding: 'utf8', timeout: 10000,
});
ok(ff.status !== 0 && /Brak wymaganych zmiennych/.test(`${ff.stderr}${ff.stdout}`), 'NFR-5/A1: produkcja bez JWT_SECRET nie startuje (fail-fast)');

// Regresja: środowisko INNE niż produkcja i inne niż jawnie lokalne (tu „staging", tak samo
// zachowuje się nieustawione NODE_ENV) też nie dostaje awaryjnego sekretu. Wcześniej wpadało
// w gałąź dev i startowało na stałym sekrecie z repozytorium, czyli na tokenach do podrobienia
// przez każdego, kto zna kod.
const ffStaging = spawnSync(process.execPath, ['dist/main.js'], {
  cwd: new URL('.', import.meta.url).pathname,
  env: { ...process.env, NODE_ENV: 'staging', JWT_SECRET: '', DATABASE_URL: '' },
  encoding: 'utf8', timeout: 10000,
});
ok(ffStaging.status !== 0 && /Brak wymaganych zmiennych/.test(`${ffStaging.stderr}${ffStaging.stdout}`), 'NFR-5/A1: środowisko nieprodukcyjne i nielokalne (staging) bez JWT_SECRET nie startuje');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 2 (NFR-2 + NFR-8) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
