// L4 zachodzące na zaplanowany urlop: wpis bez puli ma pierwszeństwo, a dni wspólne wracają
// do puli. Pokrycie czterech układów zakresów (pochłonięcie, początek, koniec, środek) plus
// przypadki, które kolizją zostają.
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

const emp = await prisma.employee.create({ data: { firstName: 'Ewa', lastName: 'PRIO', email: 'prioewa@x.pl', login: 'prioewa', role: 'EMPLOYEE', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Nieobecność PRIO' } });
const l4 = await prisma.absenceType.create({ data: { name: 'L4 PRIO', affectsPool: false, specialCategory: true } });

const a = as(await login('prioewa', 'haslo123'));
const post = (typeId, dateFrom, dateTo) => a('/absences', { method: 'POST', body: JSON.stringify({ employeeId: emp.id, typeId, dateFrom, dateTo }) });
const addUrlop = async (dateFrom, dateTo) => j(await post(urlop.id, dateFrom, dateTo));
const used = async () => (await j(await a(`/employees/${emp.id}/balance`))).used;
const spans = async () => (await prisma.absence.findMany({ where: { employeeId: emp.id, typeId: urlop.id }, orderBy: { dateFrom: 'asc' } }))
  .map((x) => `${x.dateFrom.toISOString().slice(0, 10)}..${x.dateTo.toISOString().slice(0, 10)}`);
const wipe = () => prisma.absence.deleteMany({ where: { employeeId: emp.id } });

// ── 1. L4 pochłania cały urlop ────────────────────────────────────────────────
// urlop pn 10 – pt 14 sie 2026 (5 dni roboczych), L4 sob 8 – nd 16 sie
await addUrlop('2026-08-10', '2026-08-14');
ok((await used()) === 5, 'start: 5 dni urlopu zdjęte z puli');
ok((await post(l4.id, '2026-08-08', '2026-08-16')).ok, 'L4 zachodzące na urlop zapisuje się (bez kolizji)');
ok((await spans()).length === 0, 'urlop pochłonięty w całości → wpis znika');
ok((await used()) === 0, 'wszystkie 5 dni wróciło do puli');

// ── 2. L4 na początku urlopu ─────────────────────────────────────────────────
await wipe();
await addUrlop('2026-08-10', '2026-08-21'); // pn–pt, 10 dni roboczych
ok((await used()) === 10, 'start: 10 dni urlopu');
ok((await post(l4.id, '2026-08-10', '2026-08-12')).ok, 'L4 na początku urlopu zapisuje się');
ok((await spans()).join() === '2026-08-13..2026-08-21', 'urlop przycięty od początku');
ok((await used()) === 7, '3 dni robocze wróciły do puli (10 → 7)');

// ── 3. L4 na końcu urlopu ────────────────────────────────────────────────────
await wipe();
await addUrlop('2026-08-10', '2026-08-21');
ok((await post(l4.id, '2026-08-20', '2026-08-25')).ok, 'L4 na końcu urlopu zapisuje się');
ok((await spans()).join() === '2026-08-10..2026-08-19', 'urlop przycięty od końca');
ok((await used()) === 8, '2 dni wróciły do puli (10 → 8)');

// ── 4. L4 w środku urlopu → rozcięcie na dwa wpisy ───────────────────────────
await wipe();
await addUrlop('2026-08-10', '2026-08-21');
ok((await post(l4.id, '2026-08-13', '2026-08-17')).ok, 'L4 w środku urlopu zapisuje się');
ok((await spans()).join() === '2026-08-10..2026-08-12,2026-08-18..2026-08-21', 'urlop rozcięty na dwa wpisy');
ok((await used()) === 7, '3 dni robocze (13,14,17 sie) wróciły do puli (10 → 7)');

// ── 5. Podgląd przed zapisem mówi to samo co zapis ────────────────────────────
await wipe();
await addUrlop('2026-09-07', '2026-09-11'); // pn–pt, 5 dni
const pv = await j(await a(`/absences/preview?employeeId=${emp.id}&from=2026-09-09&to=2026-09-11&dayPart=FULL&typeId=${l4.id}`));
ok(pv.collision === false, 'podgląd L4 nie zgłasza kolizji');
ok(pv.returnedDays === 3, 'podgląd zapowiada 3 dni wracające do puli');
ok(pv.remainingAfter === pv.remaining + 3, 'podgląd: L4 nie zjada puli, tylko oddaje dni');
const pvUrlop = await j(await a(`/absences/preview?employeeId=${emp.id}&from=2026-09-09&to=2026-09-11&dayPart=FULL&typeId=${urlop.id}`));
ok(pvUrlop.collision === true, 'podgląd urlopu na urlop nadal zgłasza kolizję');

// ── 6. Co pierwszeństwa NIE ma ───────────────────────────────────────────────
ok((await post(urlop.id, '2026-09-09', '2026-09-11')).status === 409, 'urlop na urlop → nadal 409');
await wipe();
await addUrlop('2026-10-05', '2026-10-09');
await j(await post(l4.id, '2026-10-05', '2026-10-09'));
ok((await post(l4.id, '2026-10-06', '2026-10-07')).status === 409, 'L4 na L4 → 409 (to prawdziwa kolizja, nie pierwszeństwo)');

// ── 7. Ślad w audycie ────────────────────────────────────────────────────────
ok(!!(await prisma.auditLog.findFirst({ where: { action: 'ABSENCE_DISPLACED', userId: emp.id } })), 'wyparcie wpisu odnotowane w audycie');

await prisma.$disconnect();
console.log(failures === 0 ? '\nPIERWSZEŃSTWO L4 OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
