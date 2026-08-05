// Smoke test Kroku 5: raport wykorzystania + drążenie hierarchii + eksport .xlsx (RODO-safe) + RBAC.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';
import ExcelJS from 'exceljs';

const API = process.env.API ?? 'http://localhost:3100/api';
const prisma = new PrismaClient();
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };
const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const login = async (l, p) => (await j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: l, password: p }) }))).token;
const as = (t) => (p, o = {}) => fetch(API + p, { ...o, headers: { authorization: `Bearer ${t}`, ...(o.headers || {}) } });

for (let i = 0; i < 30; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

// --- hierarchia pion › departament › Tribe › squad ---
const pion = await prisma.orgUnit.create({ data: { name: 'Pion K5', type: 'PION' } });
const dept = await prisma.orgUnit.create({ data: { name: 'Dept K5', type: 'DEPARTAMENT', parentId: pion.id } });
const tribe = await prisma.orgUnit.create({ data: { name: 'Tribe K5', type: 'TRIBE', parentId: dept.id } });
const squad = await prisma.orgUnit.create({ data: { name: 'Squad K5', type: 'SQUAD', parentId: tribe.id } });
const mk = (first, login, role, emp = 'UOP') => prisma.employee.create({ data: { firstName: first, lastName: 'K5', email: `${login}@k5.pl`, login, role, employmentType: emp, startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
await mk('Adm', 'k5admin', 'ADMIN');
const lider = await mk('Lider', 'k5lider', 'LEADER');     // w Tribe → zasięg raportowy obejmuje squad (H2)
const lider2 = await mk('Lider2', 'k5lider2', 'LEADER');  // bez członkostwa → poza zasięgiem (H2)
const worker = await mk('Prac', 'k5prac', 'EMPLOYEE');
const anna = await mk('Anna', 'k5anna', 'EMPLOYEE', 'UOP');
const bartek = await mk('Bartek', 'k5bartek', 'EMPLOYEE', 'B2B');
await prisma.orgUnitMembership.createMany({ data: [{ employeeId: anna.id, orgUnitId: squad.id }, { employeeId: bartek.id, orgUnitId: squad.id }, { employeeId: lider.id, orgUnitId: tribe.id }] });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop K5' } });
const l4 = await prisma.absenceType.create({ data: { name: 'L4 K5', affectsPool: false, specialCategory: true } });
await prisma.absence.createMany({ data: [
  { employeeId: anna.id, typeId: urlop.id, dateFrom: new Date('2026-06-08'), dateTo: new Date('2026-06-12') }, // 5 dni
  { employeeId: anna.id, typeId: l4.id, dateFrom: new Date('2026-06-15'), dateTo: new Date('2026-06-16') }, // L4 — bez puli
  { employeeId: bartek.id, typeId: urlop.id, dateFrom: new Date('2026-06-08'), dateTo: new Date('2026-06-10') }, // 3 dni
] });

const aAdmin = as(await login('k5admin', 'haslo123'));

// --- FR-F2: raport wykorzystania ---
const usage = await j(await aAdmin(`/reports/usage?unitId=${squad.id}`));
const annaRow = usage.rows.find((r) => r.employeeId === anna.id);
const bartekRow = usage.rows.find((r) => r.employeeId === bartek.id);
ok(annaRow?.used === 5 && annaRow?.remaining === 21, 'usage: Anna wykorzystano 5, pozostało 21 (L4 nie liczone)');
ok(bartekRow?.used === 3 && bartekRow?.employmentType === 'B2B', 'usage: Bartek (B2B) wykorzystano 3');
ok(usage.totals.used === 8, 'usage: suma wykorzystania 8');

// --- FR-F3: drążenie hierarchii (agregacja w górę do pionu) ---
const tree = await j(await aAdmin(`/reports/tree?unitId=${pion.id}`));
ok(tree.type === 'PION' && tree.used === 8 && tree.headcount === 3, 'tree: pion agreguje 8 dni / 3 osoby (anna, bartek, lider)');
ok(tree.children?.[0]?.children?.[0]?.children?.[0]?.type === 'SQUAD', 'tree: pełne drążenie pion›dept›tribe›squad');

// --- FR-F1/J4: eksport .xlsx (RODO-safe: bez typów/L4) ---
const res = await aAdmin(`/reports/usage/export?unitId=${squad.id}`);
ok(res.headers.get('content-type')?.includes('spreadsheet'), 'eksport: content-type xlsx');
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(await res.arrayBuffer());
const ws = wb.worksheets[0];
const headers = ws.getRow(1).values.filter(Boolean).map(String);
ok(headers.includes('Pracownik') && headers.includes('Wykorzystano'), 'eksport: kolumny raportu obecne');
ok(!headers.some((h) => /typ|chorob|L4/i.test(h)), 'eksport: brak kolumny typu/L4 (RODO)');
let hasL4 = false;
ws.eachRow((row) => row.eachCell((c) => { if (/L4|chorob/i.test(String(c.value ?? ''))) hasL4 = true; }));
ok(!hasL4, 'eksport: żadna komórka nie ujawnia L4 (FR-J4)');

// --- RBAC: raporty niedostępne dla zwykłego pracownika ---
const aWorker = as(await login('k5prac', 'haslo123'));
ok((await aWorker(`/reports/usage?unitId=${squad.id}`)).status === 403, 'pracownik nie ma dostępu do raportów → 403');
const aLider = as(await login('k5lider', 'haslo123'));
ok((await aLider(`/reports/usage?unitId=${squad.id}`)).ok, 'lider w Tribe ma dostęp do raportów swojej jednostki → ok');
// H2 — lider spoza zasięgu (bez członkostwa) nie widzi cudzej jednostki
const aLider2 = as(await login('k5lider2', 'haslo123'));
ok((await aLider2(`/reports/usage?unitId=${squad.id}`)).status === 403, 'lider spoza zasięgu Tribe → 403 (H2 scoping)');

await prisma.$disconnect();
console.log(failures === 0 ? '\nKROK 5 OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
