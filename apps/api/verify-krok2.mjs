// Smoke test Kroku 2: wpis nieobecności + walidacja (kolizja, pula, zakres) + licznik + usuwanie.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';

const API = process.env.API ?? 'http://localhost:3100/api';
const prisma = new PrismaClient();
let failures = 0;
let token = '';
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };
const H = () => ({ 'content-type': 'application/json', authorization: `Bearer ${token}` });
const post = (p, b) => fetch(API + p, { method: 'POST', headers: H(), body: JSON.stringify(b) });
const put = (p, b) => fetch(API + p, { method: 'PUT', headers: H(), body: JSON.stringify(b) });
const getj = async (p) => { const r = await fetch(API + p, { headers: H() }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };

for (let i = 0; i < 30; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

// API zabezpieczone RBAC — bootstrap admina + token.
await prisma.employee.create({ data: { firstName: 'Adm', lastName: 'K2', email: 'admin@k2.pl', login: 'k2admin', role: 'ADMIN', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
token = (await j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: 'k2admin', password: 'haslo123' }) }))).token;

const urlop = await j(await post('/absence-types', { name: 'Urlop' }));
const l4 = await j(await post('/absence-types', { name: 'L4', affectsPool: false, specialCategory: true }));
await j(await put('/pools/default', { value: 3 })); // mała pula, by przetestować przekroczenie
const anna = await j(await post('/employees', { firstName: 'Anna', lastName: 'Kowalska', email: 'a@x.pl', login: 'a', employmentType: 'UOP', startDate: '2026-01-01' }));

// poprawny wpis: pon–śr 22–24.06.2026 = 3 dni robocze
await j(await post('/absences', { employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-06-22', dateTo: '2026-06-24' }));
let bal = await getj(`/employees/${anna.id}/balance`);
ok(bal.used === 3 && bal.remaining === 0, 'wpis 3 dni → wykorzystano 3, pozostało 0 (pula 3)');

// kolizja terminu (FR-A7)
ok((await post('/absences', { employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-06-23', dateTo: '2026-06-23' })).status === 409, 'kolizja z istniejącym wpisem → 409');

// przekroczenie puli (FR-A7)
ok((await post('/absences', { employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-06-25', dateTo: '2026-06-26' })).status === 400, 'przekroczenie puli → 400');

// zakres odwrócony (FR-A7)
ok((await post('/absences', { employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-07-10', dateTo: '2026-07-01' })).status === 400, 'data od > do → 400');

// L4 nie obciąża puli (FR-B5)
await j(await post('/absences', { employeeId: anna.id, typeId: l4.id, dateFrom: '2026-06-25', dateTo: '2026-06-26' }));
bal = await getj(`/employees/${anna.id}/balance`);
ok(bal.remaining === 0, 'L4 dopisane, balans bez zmian (pozostało 0)');

// podgląd skutku przed zapisem (FR-A2)
const pv = await getj(`/absences/preview?employeeId=${anna.id}&from=2026-06-29&to=2026-06-30`);
ok(pv.workingDays === 2 && pv.remainingAfter === -2, 'preview: 2 dni robocze, po zapisie -2');

// usunięcie własnego wpisu → balans wraca (FR-A4)
const list = await getj(`/absences?employeeId=${anna.id}`);
const first = list.find((a) => a.dateFrom.slice(0, 10) === '2026-06-22');
await fetch(`${API}/absences/${first.id}`, { method: 'DELETE', headers: H() });
bal = await getj(`/employees/${anna.id}/balance`);
ok(bal.remaining === 3, 'po usunięciu urlopu → pozostało 3');

await prisma.$disconnect();
console.log(failures === 0 ? '\nKROK 2 OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
