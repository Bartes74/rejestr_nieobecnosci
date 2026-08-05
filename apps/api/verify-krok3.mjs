// Smoke test Kroku 3: auth + RBAC + ochrona L4 + widoczność Tribe + jednolity kalendarz.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';

const API = process.env.API ?? 'http://localhost:3100/api';
const prisma = new PrismaClient();
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };
const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const login = async (l, p) => j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: l, password: p }) })).then((x) => x.token);
const as = (token) => (p, opts = {}) => fetch(API + p, { ...opts, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(opts.headers || {}) } });

for (let i = 0; i < 30; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

// --- struktura org + użytkownicy (bootstrap przez Prisma) ---
const tribeX = await prisma.orgUnit.create({ data: { name: 'Tribe X', type: 'TRIBE' } });
const squadA = await prisma.orgUnit.create({ data: { name: 'Squad A', type: 'SQUAD', parentId: tribeX.id } });
const tribeY = await prisma.orgUnit.create({ data: { name: 'Tribe Y', type: 'TRIBE' } });
const squadC = await prisma.orgUnit.create({ data: { name: 'Squad C', type: 'SQUAD', parentId: tribeY.id } });
const mk = (first, login, role) => prisma.employee.create({ data: { firstName: first, lastName: 'Test', email: `${login}@x.pl`, login, role, employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const admin = await mk('Admin', 'admin', 'ADMIN');
const anna = await mk('Anna', 'anna', 'EMPLOYEE');
const bartek = await mk('Bartek', 'bartek', 'EMPLOYEE');
const celina = await mk('Celina', 'celina', 'EMPLOYEE');
await prisma.orgUnitMembership.createMany({ data: [
  { employeeId: anna.id, orgUnitId: squadA.id },
  { employeeId: bartek.id, orgUnitId: squadA.id },
  { employeeId: celina.id, orgUnitId: squadC.id },
] });

const aAdmin = as(await login('admin', 'haslo123'));
const aAnna = as(await login('anna', 'haslo123'));
const aBartek = as(await login('bartek', 'haslo123'));

// --- auth wymagane ---
ok((await fetch(`${API}/employees`)).status === 401, 'bez tokenu → 401');
ok((await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: 'anna', password: 'złe' }) })).status === 401, 'złe hasło → 401');

// --- RBAC: konfiguracja tylko admin ---
ok((await aAnna('/absence-types', { method: 'POST', body: JSON.stringify({ name: 'X' }) })).status === 403, 'pracownik nie tworzy typu → 403');
const urlop = await j(await aAdmin('/absence-types', { method: 'POST', body: JSON.stringify({ name: 'Urlop' }) }));
const l4 = await j(await aAdmin('/absence-types', { method: 'POST', body: JSON.stringify({ name: 'L4', affectsPool: false, specialCategory: true }) }));
ok(!!urlop && !!l4, 'admin tworzy typy');
ok((await aAnna('/pools/default', { method: 'PUT', body: JSON.stringify({ value: 26 }) })).status === 403, 'pracownik nie ustawia puli → 403');
await j(await aAdmin('/pools/default', { method: 'PUT', body: JSON.stringify({ value: 26 }) }));

// --- własność wpisu ---
await j(await aAnna('/absences', { method: 'POST', body: JSON.stringify({ employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-06-08', dateTo: '2026-06-09' }) }));
ok((await aAnna('/absences', { method: 'POST', body: JSON.stringify({ employeeId: bartek.id, typeId: urlop.id, dateFrom: '2026-06-08', dateTo: '2026-06-09' }) })).status === 403, 'pracownik nie wpisuje cudzej nieobecności → 403');
ok((await aAdmin('/absences', { method: 'POST', body: JSON.stringify({ employeeId: bartek.id, typeId: urlop.id, dateFrom: '2026-06-10', dateTo: '2026-06-10' }) })).ok, 'admin wpisuje w imieniu innych (delegacja) → ok');

// --- ochrona L4 (FR-J1/H3) ---
await j(await aAnna('/absences', { method: 'POST', body: JSON.stringify({ employeeId: anna.id, typeId: l4.id, dateFrom: '2026-06-15', dateTo: '2026-06-16' }) }));
ok((await aBartek(`/absences?employeeId=${anna.id}`)).status === 403, 'pracownik nie czyta cudzych wpisów (typów) → 403');
const adminRead = await j(await aAdmin(`/absences?employeeId=${anna.id}`));
ok(adminRead.some((a) => a.type?.name === 'L4'), 'uprawniony (admin) widzi typ L4');
const ownRead = await j(await aAnna(`/absences?employeeId=${anna.id}`));
ok(ownRead.some((a) => a.type?.name === 'L4'), 'właściciel widzi własne L4');
ok(!!(await prisma.auditLog.findFirst({ where: { action: 'VIEW_TYPES', userId: admin.id } })), 'dostęp admina do typów L4 zapisany w audycie (FR-J1)');

// --- kalendarz: widoczność Tribe + prezentacja jednolita ---
const cal = await j(await aAnna('/calendar?from=2026-06-01&to=2026-06-30'));
const ids = new Set(cal.map((e) => e.employeeId));
ok(ids.has(anna.id) && ids.has(bartek.id), 'kalendarz: widzę swój Tribe (Anna + Bartek)');
ok(!ids.has(celina.id), 'kalendarz: nie widzę innego Tribe (Celina)');
ok(cal.every((e) => !('type' in e) && !('specialCategory' in e)), 'kalendarz jednolity — bez typu/L4 (D1/C3/H3)');

await prisma.$disconnect();
console.log(failures === 0 ? '\nKROK 3 OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
