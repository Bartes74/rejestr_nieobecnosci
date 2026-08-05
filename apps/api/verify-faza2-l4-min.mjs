// Faza 2: FR-B10 konwersja nieobecności na L4 (zwrot dnia do puli) + FR-B4 minimum do pozostawienia.
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

const admin = await prisma.employee.create({ data: { firstName: 'Adm', lastName: 'B10', email: 'b10admin@x.pl', login: 'b10admin', role: 'ADMIN', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const bob = await prisma.employee.create({ data: { firstName: 'Bob', lastName: 'B10', email: 'b10bob@x.pl', login: 'b10bob', role: 'EMPLOYEE', employmentType: 'UOP', minimumToLeave: 4, startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop B10' } });
await prisma.absenceType.create({ data: { name: 'L4 B10', affectsPool: false, specialCategory: true } });

const aAdmin = as(await login('b10admin', 'haslo123'));
const aBob = as(await login('b10bob', 'haslo123'));

// bob wpisuje 5 dni urlopu (08–12.06)
const abs = await j(await aBob('/absences', { method: 'POST', body: JSON.stringify({ employeeId: bob.id, typeId: urlop.id, dateFrom: '2026-06-08', dateTo: '2026-06-12' }) }));
let bal = await j(await aBob(`/employees/${bob.id}/balance`));
ok(bal.used === 5 && bal.remaining === 21, 'przed: wykorzystano 5, pozostało 21');
ok(bal.minimumToLeave === 4, 'FR-B4: balans zwraca minimum do pozostawienia (4)');

// pracownik nie może sam konwertować na L4
ok((await aBob(`/absences/${abs.id}/convert-to-l4`, { method: 'POST' })).status === 403, 'pracownik nie konwertuje na L4 → 403');

// osoba uprawniona (admin) konwertuje → dzień wraca do puli
await j(await aAdmin(`/absences/${abs.id}/convert-to-l4`, { method: 'POST' }));
bal = await j(await aBob(`/employees/${bob.id}/balance`));
ok(bal.used === 0 && bal.remaining === 26, 'FR-B10: po konwersji na L4 dni wracają (wykorzystano 0, pozostało 26)');
ok(!!(await prisma.auditLog.findFirst({ where: { action: 'ABSENCE_TO_L4', userId: admin.id } })), 'konwersja na L4 odnotowana w audycie');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 2 (L4 + minimum) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
