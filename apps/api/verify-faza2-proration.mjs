// Faza 2: FR-B9 — proporcjonalna pula (proration) + blokada nieobecności po dacie odejścia.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';

const API = process.env.API ?? 'http://localhost:3100/api';
const prisma = new PrismaClient();
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };
const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const login = async (l, p) => (await j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: l, password: p }) }))).token;
const as = (t) => (p, o = {}) => fetch(API + p, { ...o, headers: { 'content-type': 'application/json', authorization: `Bearer ${t}`, ...(o.headers || {}) } });

for (let i = 0; i < 30; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const mk = (login, role, extra = {}) => prisma.employee.create({ data: { firstName: login, lastName: 'B9', email: `${login}@x.pl`, login, role, employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123'), ...extra } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop B9' } });
const admin = await mk('b9admin', 'ADMIN');
const mid = await mk('b9mid', 'EMPLOYEE', { startDate: new Date('2026-07-01') }); // wszedł w połowie roku
const leaver = await mk('b9leaver', 'EMPLOYEE', { endDate: new Date('2026-06-30') }); // odchodzi 30.06

const aAdmin = as(await login('b9admin', 'haslo123'));
const aMid = as(await login('b9mid', 'haslo123'));
// Osoba po dacie zakończenia współpracy nie zaloguje się (patrz verify-sesja-uniewaznienie),
// więc wpisy w jej sprawie robi administrator. Reguła FR-B9 sprawdzana niżej i tak dotyczy
// osoby, KTÓREJ wpis dotyczy, a nie tej, która go wprowadza — więc badamy dokładnie to samo.
ok((await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: 'b9leaver', password: 'haslo123' }) })).status === 401, 'osoba po dacie odejścia nie zaloguje się');

// FR-B9 — proporcjonalna pula dla osoby zatrudnionej od 1 lipca (~połowa z 26)
let balMid = await j(await aMid(`/employees/${mid.id}/balance`));
ok(balMid.pool >= 12 && balMid.pool <= 14, `proration: pula ~połowa (${balMid.pool} z 26)`);

// korekta indywidualna (override) ma priorytet — bez proraty
await j(await aAdmin('/pools/allowance', { method: 'PUT', body: JSON.stringify({ employeeId: mid.id, periodYear: 2026, baseDays: 26, overrideDays: 20 }) }));
balMid = await j(await aMid(`/employees/${mid.id}/balance`));
ok(balMid.pool === 20, 'override pomija proratę (pula 20)');

// FR-B9 — nieobecność po dacie odejścia blokowana; przed datą — dozwolona
ok((await aAdmin('/absences', { method: 'POST', body: JSON.stringify({ employeeId: leaver.id, typeId: urlop.id, dateFrom: '2026-08-01', dateTo: '2026-08-01' }) })).status === 400, 'nieobecność po dacie odejścia → 400');
ok((await aAdmin('/absences', { method: 'POST', body: JSON.stringify({ employeeId: leaver.id, typeId: urlop.id, dateFrom: '2026-06-10', dateTo: '2026-06-10' }) })).ok, 'nieobecność przed datą odejścia → ok');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 2 (proration) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
