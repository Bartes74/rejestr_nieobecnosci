// Smoke test Kroku 4: capacity per sprint + alert kolizji kluczowych ról + import sprintów + RBAC.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';
import ExcelJS from 'exceljs';

const API = process.env.API ?? 'http://localhost:3100/api';
const prisma = new PrismaClient();
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };
const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const login = async (l, p) => (await j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: l, password: p }) }))).token;
const as = (t) => (p, o = {}) => fetch(API + p, { ...o, headers: { 'content-type': 'application/json', authorization: `Bearer ${t}`, ...(o.headers || {}) } });

for (let i = 0; i < 30; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

// --- bootstrap ---
const tribe = await prisma.orgUnit.create({ data: { name: 'Tribe K4', type: 'TRIBE' } });
const squad = await prisma.orgUnit.create({ data: { name: 'Squad K4', type: 'SQUAD', parentId: tribe.id } });
const mk = (first, login, role, key = false) => prisma.employee.create({ data: { firstName: first, lastName: 'K4', email: `${login}@k4.pl`, login, role, employmentType: 'UOP', isKeyRole: key, startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const k4admin = await mk('Adm', 'k4admin', 'ADMIN');
const anna = await mk('Anna', 'k4anna', 'EMPLOYEE', true);   // rola kluczowa
const bartek = await mk('Bartek', 'k4bartek', 'EMPLOYEE', true); // rola kluczowa
const celina = await mk('Celina', 'k4celina', 'EMPLOYEE', false);
await prisma.orgUnitMembership.createMany({ data: [
  { employeeId: anna.id, orgUnitId: squad.id },
  { employeeId: bartek.id, orgUnitId: squad.id },
  { employeeId: celina.id, orgUnitId: squad.id },
] });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop K4' } }); // affectsCapacity=true (domyślnie)

const adminToken = await login('k4admin', 'haslo123');
const aAdmin = as(adminToken);

// sprint 22.06–03.07.2026 = 10 dni roboczych
const sprint = await j(await aAdmin('/sprints', { method: 'POST', body: JSON.stringify({ name: 'Sprint 13', dateFrom: '2026-06-22', dateTo: '2026-07-03', squadId: squad.id }) }));

// nieobecności: Anna 22–24, Bartek 23–25 (kolizja 23–24), Celina 26
await prisma.absence.createMany({ data: [
  { employeeId: anna.id, typeId: urlop.id, dateFrom: new Date('2026-06-22'), dateTo: new Date('2026-06-24') },
  { employeeId: bartek.id, typeId: urlop.id, dateFrom: new Date('2026-06-23'), dateTo: new Date('2026-06-25') },
  { employeeId: celina.id, typeId: urlop.id, dateFrom: new Date('2026-06-26'), dateTo: new Date('2026-06-26') },
] });

// --- FR-D2: capacity ---
const cap = await j(await aAdmin(`/capacity?sprintId=${sprint.id}&unitId=${squad.id}`));
console.log('  capacity:', JSON.stringify({ total: cap.totalPersonDays, absent: cap.absentPersonDays, available: cap.available, collisions: cap.keyRoleCollisions.length }));
ok(cap.totalPersonDays === 30, 'capacity: 3 osoby × 10 dni = 30 osobodni');
ok(cap.absentPersonDays === 7, 'capacity: nieobecne 7 osobodni (3+3+1)');
ok(cap.available === 23, 'capacity: dostępne 23');

// --- FR-D3: kolizja kluczowych ról ---
ok(cap.keyRoleCollisions.length === 1, 'alert: 1 kolizja kluczowych ról');
const col = cap.keyRoleCollisions[0];
ok(col?.dateFrom === '2026-06-23' && col?.dateTo === '2026-06-24', 'kolizja w dniach 23–24.06');
ok(col?.employees.includes('Anna K4') && col?.employees.includes('Bartek K4'), 'kolizja: Anna + Bartek (Celina nie jest kluczowa)');

// --- FR-D4: import sprintów .xlsx ---
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Sprinty');
ws.addRow(['Sprint', 'Od', 'Do', 'Squad']);
ws.addRow(['Sprint 14', '2026-07-06', '2026-07-17', 'Squad K4']);
const xlsx = await wb.xlsx.writeBuffer();
const fd = new FormData();
fd.append('file', new Blob([xlsx]), 'sprinty.xlsx');
// multipart: bez content-type (fetch ustawi boundary sam), tylko autoryzacja
const imp = await j(await fetch(`${API}/sprints/import`, { method: 'POST', body: fd, headers: { authorization: `Bearer ${adminToken}` } }));
ok(imp.created === 1, 'import sprintów: utworzono 1');

// --- RBAC: capacity niedostępne dla zwykłego pracownika ---
const aCelina = as(await login('k4celina', 'haslo123'));
ok((await aCelina(`/capacity?sprintId=${sprint.id}&unitId=${squad.id}`)).status === 403, 'pracownik nie widzi capacity → 403');

await prisma.$disconnect();
console.log(failures === 0 ? '\nKROK 4 OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
