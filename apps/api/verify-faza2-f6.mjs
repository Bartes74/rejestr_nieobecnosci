// Faza 2: FR-F6 — stabilny, wersjonowany eksport dla płac/PMO (RODO-safe).
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';

const API = process.env.API ?? 'http://localhost:3100/api';
const prisma = new PrismaClient();
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };
const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const login = async (l, p) => (await j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: l, password: p }) }))).token;
const as = (t) => (p, o = {}) => fetch(API + p, { ...o, headers: { authorization: `Bearer ${t}`, ...(o.headers || {}) } });

for (let i = 0; i < 30; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const tribe = await prisma.orgUnit.create({ data: { name: 'Tribe F6', type: 'TRIBE' } });
const squad = await prisma.orgUnit.create({ data: { name: 'Squad F6', type: 'SQUAD', parentId: tribe.id } });
const mk = (login, role) => prisma.employee.create({ data: { firstName: login, lastName: 'F6', email: `${login}@x.pl`, login, role, employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop F6' } });
const l4 = await prisma.absenceType.create({ data: { name: 'L4 F6', affectsPool: false, specialCategory: true } });
await mk('f6admin', 'ADMIN');
await mk('f6pmo', 'PMO');
const anna = await mk('f6anna', 'EMPLOYEE');
await prisma.orgUnitMembership.create({ data: { employeeId: anna.id, orgUnitId: squad.id } });
await prisma.absence.createMany({ data: [
  { employeeId: anna.id, typeId: urlop.id, dateFrom: new Date('2026-06-08'), dateTo: new Date('2026-06-12') }, // 5 dni urlopu
  { employeeId: anna.id, typeId: l4.id, dateFrom: new Date('2026-06-15'), dateTo: new Date('2026-06-17') }, // 3 dni L4
] });

const aAdmin = as(await login('f6admin', 'haslo123'));
const aPmo = as(await login('f6pmo', 'haslo123'));

// schemat — stabilny i wersjonowany
const schema = await j(await aAdmin('/reports/export/payroll/schema'));
ok(schema.version === '1.1' && schema.fields.length >= 7, 'schemat eksportu wersjonowany (1.1) i udokumentowany');

// admin (VIEW_L4) widzi dni kategorii szczególnej
const admExp = await j(await aAdmin(`/reports/export/payroll?unitId=${squad.id}`));
const ra = admExp.records.find((r) => r.employeeId === anna.id);
ok(admExp.schemaVersion === '1.1' && ra.leaveDaysUsed === 5, 'eksport: leaveDaysUsed = 5 (urlop)');
ok(ra.specialCategoryDays === 3, 'admin widzi specialCategoryDays = 3 (L4)');

// PMO (bez VIEW_L4) — RODO-safe: brak pola specialCategoryDays
const pmoExp = await j(await aPmo(`/reports/export/payroll?unitId=${squad.id}`));
const rp = pmoExp.records.find((r) => r.employeeId === anna.id);
ok(rp.leaveDaysUsed === 5 && rp.specialCategoryDays === undefined, 'PMO: dni urlopu tak, L4 ukryte (RODO-safe, FR-J4)');

// pracownik nie ma dostępu
ok((await as(await login('f6anna', 'haslo123'))(`/reports/export/payroll?unitId=${squad.id}`)).status === 403, 'pracownik nie ma dostępu do eksportu płac → 403');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 2 (eksport płac F6) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
