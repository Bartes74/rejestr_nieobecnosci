// Faza 2: powiadomienia e-mail (FR-E1 lider o B2B/OUT, FR-E3 przypomnienia o zaległym urlopie).
// SMTP_ENABLED=false → jsonTransport; każdą wysyłkę odnotowujemy w audycie (EMAIL_SENT).
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';

const API = process.env.API ?? 'http://localhost:3100/api';
const prisma = new PrismaClient();
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };
const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const login = async (l, p) => (await j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: l, password: p }) }))).token;
const as = (t) => (p, o = {}) => fetch(API + p, { ...o, headers: { 'content-type': 'application/json', authorization: `Bearer ${t}`, ...(o.headers || {}) } });
const emailCount = () => prisma.auditLog.count({ where: { entity: 'Email' } });

for (let i = 0; i < 30; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const tribe = await prisma.orgUnit.create({ data: { name: 'TribeE F2', type: 'TRIBE' } });
const squad = await prisma.orgUnit.create({ data: { name: 'SquadE F2', type: 'SQUAD', parentId: tribe.id } });
const mk = (first, login, role, emp = 'UOP') => prisma.employee.create({ data: { firstName: first, lastName: 'F2E', email: `${login}@f2e.pl`, login, role, employmentType: emp, startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const admin = await mk('Adm', 'f2eadmin', 'ADMIN');
const lider = await mk('Lider', 'f2elider', 'LEADER');
const bob = await mk('Bob', 'f2ebob', 'EMPLOYEE', 'B2B');
const una = await mk('Una', 'f2euna', 'EMPLOYEE', 'UOP');
await prisma.orgUnitMembership.createMany({ data: [
  { employeeId: lider.id, orgUnitId: squad.id },
  { employeeId: bob.id, orgUnitId: squad.id },
  { employeeId: una.id, orgUnitId: squad.id },
] });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop F2E' } });
await prisma.leaveAllowance.create({ data: { employeeId: bob.id, periodYear: 2026, baseDays: 26, carriedOver: 3 } });

const aAdmin = as(await login('f2eadmin', 'haslo123'));
const aBob = as(await login('f2ebob', 'haslo123'));
const aUna = as(await login('f2euna', 'haslo123'));

// --- FR-E1: B2B → powiadomienie lidera ---
await j(await aBob('/absences', { method: 'POST', body: JSON.stringify({ employeeId: bob.id, typeId: urlop.id, dateFrom: '2026-06-08', dateTo: '2026-06-09' }) }));
ok(!!(await prisma.auditLog.findFirst({ where: { entity: 'Email', action: 'EMAIL_SENT', userId: lider.id } })), 'lider powiadomiony o nieobecności B2B (FR-E1)');

// --- negatywny: UoP nie generuje powiadomienia do lidera ---
const before = await emailCount();
await j(await aUna('/absences', { method: 'POST', body: JSON.stringify({ employeeId: una.id, typeId: urlop.id, dateFrom: '2026-06-08', dateTo: '2026-06-09' }) }));
ok((await emailCount()) === before, 'UoP nie generuje powiadomienia (FR-E1 tylko B2B/OUT)');

// --- FR-E3: przypomnienia o zaległym urlopie ---
const rem = await j(await aAdmin('/notifications/overdue-reminders', { method: 'POST' }));
ok(rem.sent >= 1, `wysłano przypomnienia (${rem.sent})`);
ok(!!(await prisma.auditLog.findFirst({ where: { entity: 'Email', action: 'EMAIL_SENT', userId: bob.id, description: { contains: 'Przypomnienie' } } })), 'Bob dostał przypomnienie o zaległym urlopie (FR-E3)');

// --- RBAC: pracownik nie odpala przypomnień ---
ok((await aBob('/notifications/overdue-reminders', { method: 'POST' })).status === 403, 'pracownik nie odpala przypomnień → 403');

await prisma.$disconnect();
console.log(failures === 0 ? '\nPOWIADOMIENIA E-MAIL OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
