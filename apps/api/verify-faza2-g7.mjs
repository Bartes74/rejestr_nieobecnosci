// Faza 2: FR-G7 — capacity liczone wg kalendarza świąt właściwego dla każdej osoby.
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

const tribe = await prisma.orgUnit.create({ data: { name: 'Tribe G7', type: 'TRIBE' } });
const squad = await prisma.orgUnit.create({ data: { name: 'Squad G7', type: 'SQUAD', parentId: tribe.id } });
// kalendarz lokalizacji bob-a z dniem wolnym 24.06 (środa w sprincie)
const calX = await prisma.holidayCalendar.create({ data: { name: 'Lokalizacja X', holidays: { create: [{ date: new Date('2026-06-24'), name: 'Święto lokalne' }] } } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop G7' } });
const admin = await prisma.employee.create({ data: { firstName: 'Adm', lastName: 'G7', email: 'g7admin@x.pl', login: 'g7admin', role: 'ADMIN', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const alice = await prisma.employee.create({ data: { firstName: 'Alice', lastName: 'G7', email: 'g7alice@x.pl', login: 'g7alice', role: 'EMPLOYEE', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('x') } }); // bez kalendarza
const bob = await prisma.employee.create({ data: { firstName: 'Bob', lastName: 'G7', email: 'g7bob@x.pl', login: 'g7bob', role: 'EMPLOYEE', employmentType: 'UOP', holidayCalendarId: calX.id, startDate: new Date('2026-01-01'), passwordHash: hashPassword('x') } });
await prisma.orgUnitMembership.createMany({ data: [{ employeeId: alice.id, orgUnitId: squad.id }, { employeeId: bob.id, orgUnitId: squad.id }] });

const aAdmin = as(await login('g7admin', 'haslo123'));
// sprint 22–26.06.2026 (pon–pt = 5 dni roboczych); dla bob-a 24.06 to święto → 4 dni
const sprint = await j(await aAdmin('/sprints', { method: 'POST', body: JSON.stringify({ name: 'Sprint G7', dateFrom: '2026-06-22', dateTo: '2026-06-26', squadId: squad.id }) }));

let cap = await j(await aAdmin(`/capacity?sprintId=${sprint.id}&unitId=${squad.id}`));
ok(cap.memberCount === 2, 'capacity: 2 osoby');
ok(cap.totalPersonDays === 9, `FR-G7: osobodni 9 (Alice 5 + Bob 4 wg jego kalendarza), nie 10`);

// bob nieobecny 23–25.06 → wg jego kalendarza: wt 23 + czw 25 = 2 dni (śr 24 to święto)
await prisma.absence.create({ data: { employeeId: bob.id, typeId: urlop.id, dateFrom: new Date('2026-06-23'), dateTo: new Date('2026-06-25') } });
cap = await j(await aAdmin(`/capacity?sprintId=${sprint.id}&unitId=${squad.id}`));
ok(cap.absentPersonDays === 2, 'FR-G7: nieobecność Boba = 2 dni (24.06 pominięte jako jego święto)');
ok(cap.available === 7, 'capacity dostępne 7 (9 − 2)');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 2 (G7 kalendarze) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
