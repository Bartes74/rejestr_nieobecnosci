// FR-B5/FR-B10 — wpis chorobowy przykrywa zaplanowaną nieobecność, ale jej nie kasuje.
//
// Kryterium odbioru, sprawdzane tu wprost: 5 dni nieobecności, potem 8 dni L4, z czego 3 wspólne.
//   • bez prawa do powodu widać 10 dni nieobecności, jednolicie
//   • z prawem do powodu — 2 dni nieobecności i 8 dni L4
//   • pula na UoP: zwrot 3 dni (wykorzystanie 5 → 2)
//   • pula na EXT/OUT: −10 dni, bo każdy dzień liczy się raz, ale liczy się
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

// 07–11.09.2026 to pn–pt (5 dni roboczych); 09–18.09 to 8 dni roboczych, 3 wspólne. Suma: 10.
const NIEOB = { dateFrom: '2026-09-07', dateTo: '2026-09-11' };
const L4 = { dateFrom: '2026-09-09', dateTo: '2026-09-18' };

const mk = (lg, role, emp) => prisma.employee.create({ data: { firstName: lg, lastName: 'NK', email: `${lg}@nk.pl`, login: lg, role, employmentType: emp, startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Nieobecność NK' } });
const l4type = await prisma.absenceType.create({ data: { name: 'L4 NK', affectsPool: false, specialCategory: true } });

const tribe = await prisma.orgUnit.create({ data: { name: 'Tribe NK', type: 'TRIBE' } });
const squad = await prisma.orgUnit.create({ data: { name: 'Squad NK', type: 'SQUAD', parentId: tribe.id } });
await mk('nkadmin', 'ADMIN', 'UOP');
const uop = await mk('nkuop', 'EMPLOYEE', 'UOP');
const ext = await mk('nkext', 'EMPLOYEE', 'OUT');
const lider = await mk('nklider', 'LEADER', 'UOP');
await prisma.orgUnitMembership.createMany({ data: [
  { employeeId: uop.id, orgUnitId: squad.id }, { employeeId: ext.id, orgUnitId: squad.id }, { employeeId: lider.id, orgUnitId: tribe.id },
] });
const sprint = await prisma.sprint.create({ data: { name: 'Sprint NK', dateFrom: new Date('2026-09-07'), dateTo: new Date('2026-09-18'), squadId: squad.id } });

const aAdmin = as(await login('nkadmin', 'haslo123'));
const aUop = as(await login('nkuop', 'haslo123'));
const aExt = as(await login('nkext', 'haslo123'));
const aLider = as(await login('nklider', 'haslo123'));

const post = (a, body) => a('/absences', { method: 'POST', body: JSON.stringify(body) });
const usedOf = async (a, id) => (await j(await a(`/employees/${id}/balance`))).used;
const rowsOf = async (a, id) => j(await a(`/absences?employeeId=${id}`));
const sumDays = (rows) => rows.reduce((s, r) => s + r.workingDays, 0);

// --- UoP: 5 dni, potem 8 dni L4 z 3 wspólnymi ---
await j(await post(aUop, { employeeId: uop.id, typeId: urlop.id, ...NIEOB }));
ok((await usedOf(aUop, uop.id)) === 5, 'UoP: sama nieobecność → wykorzystano 5');
const pv = await j(await aUop(`/absences/preview?employeeId=${uop.id}&from=${L4.dateFrom}&to=${L4.dateTo}&typeId=${l4type.id}`));
ok(pv.collision === false, 'UoP: podgląd L4 na nieobecności NIE zgłasza kolizji');
ok(pv.returnedDays === 3, 'UoP: podgląd zapowiada zwrot 3 dni');
await j(await post(aUop, { employeeId: uop.id, typeId: l4type.id, ...L4 }));
ok((await usedOf(aUop, uop.id)) === 2, 'UoP: po L4 wykorzystano 2 — 3 dni wróciły do puli');

const wDb = await prisma.absence.findMany({ where: { employeeId: uop.id } });
ok(wDb.length === 2, 'UoP: oba wpisy zostają w bazie — plan nie został skasowany');
ok(wDb.some((a) => a.dateFrom.toISOString().slice(0, 10) === NIEOB.dateFrom && a.dateTo.toISOString().slice(0, 10) === NIEOB.dateTo),
  'UoP: zaplanowana nieobecność ma nietknięty zakres 07–11.09');

// --- widoczność: te same dane, dwa poziomy szczegółu ---
const own = await rowsOf(aUop, uop.id);
const ownNieob = own.find((r) => r.typeId === urlop.id);
const ownL4 = own.find((r) => r.typeId === l4type.id);
ok(ownNieob?.workingDays === 2 && ownL4?.workingDays === 8, 'z prawem do powodu: 2 dni nieobecności + 8 dni L4');
ok(sumDays(own) === 10, 'z prawem do powodu: razem 10 dni');

const masked = await rowsOf(aLider, uop.id);
ok(masked.every((r) => r.typeId === null && r.type.name === 'Nieobecność'), 'bez prawa do powodu: wszystko jako nieobecność, bez id typu');
ok(sumDays(masked) === 10, 'bez prawa do powodu: 10 dni nieobecności');

// --- EXT: ten sam układ, inna pula ---
await j(await post(aExt, { employeeId: ext.id, typeId: urlop.id, ...NIEOB }));
ok((await usedOf(aExt, ext.id)) === 5, 'OUT: sama nieobecność → wykorzystano 5');
const pvExt = await j(await aExt(`/absences/preview?employeeId=${ext.id}&from=${L4.dateFrom}&to=${L4.dateTo}&typeId=${l4type.id}`));
ok(pvExt.collision === false && pvExt.returnedDays === 0, 'OUT: podgląd L4 bez kolizji i bez obietnicy zwrotu');
await j(await post(aExt, { employeeId: ext.id, typeId: l4type.id, ...L4 }));
ok((await usedOf(aExt, ext.id)) === 10, 'OUT: po L4 wykorzystano 10 — każdy dzień raz, żaden dwa razy');
ok((await prisma.absence.count({ where: { employeeId: ext.id } })) === 2, 'OUT: oba wpisy zostają w bazie');
ok(sumDays(await rowsOf(aExt, ext.id)) === 10, 'OUT: widok też pokazuje 10 dni');

// --- kolizją zostaje wyłącznie nieobecność na nieobecności ---
ok((await post(aUop, { employeeId: uop.id, typeId: urlop.id, dateFrom: '2026-09-08', dateTo: '2026-09-08' })).status === 409, 'nieobecność na nieobecności → 409');
ok((await post(aUop, { employeeId: uop.id, typeId: l4type.id, dateFrom: '2026-09-14', dateTo: '2026-09-14' })).ok, 'L4 na L4 → przechodzi (zapis choroby nie blokuje się nigdy)');
ok((await usedOf(aUop, uop.id)) === 2, 'drugie L4 na tym samym dniu nie rusza puli — dzień liczy się raz');
// kierunek odwrotny: na istniejącym L4 da się zaplanować nieobecność
ok((await post(aUop, { employeeId: uop.id, typeId: urlop.id, dateFrom: '2026-09-17', dateTo: '2026-09-18' })).ok, 'nieobecność na istniejącym L4 → przechodzi');
ok((await usedOf(aUop, uop.id)) === 2, 'dni pokryte przez L4 nie zabierają z puli mimo nowej nieobecności');

// --- FR-B10: konwersja działa przy każdej formie zatrudnienia ---
const doKonw = await j(await post(aExt, { employeeId: ext.id, typeId: urlop.id, dateFrom: '2026-09-21', dateTo: '2026-09-22' }));
ok((await aAdmin(`/absences/${doKonw.id}/convert-to-l4`, { method: 'POST' })).ok, 'OUT: konwersja na L4 przechodzi (zmiana rodzaju, nie zwrot dni)');
ok((await usedOf(aExt, ext.id)) === 12, 'OUT: po konwersji pula bez zmian — zmienił się rodzaj, nie liczba dni');

// --- capacity nie dubluje osobodni ---
const cap = await j(await aAdmin(`/capacity?sprintId=${sprint.id}&unitId=${squad.id}`));
ok(cap.absentPersonDays === 20, 'capacity: 2 osoby × 10 dni nieobecności — bez dublowania nakładki');
ok(cap.absentPersonDays <= cap.totalPersonDays, 'capacity: nieobecność nie przekracza osobodni zespołu');

// --- eksport płacowy: dzień trafia do jednego kubełka, nie do dwóch ---
const pay = await j(await aAdmin(`/reports/export/payroll?unitId=${squad.id}`));
const recUop = pay.records.find((r) => r.employeeId === uop.id);
ok(pay.schemaVersion === '1.1', 'eksport płacowy: wersja schematu podbita po zmianie semantyki');
ok(recUop.leaveDaysUsed === 2 && recUop.specialCategoryDays === 8,
  `eksport: dni rozdzielone bez dublowania (urlop ${recUop.leaveDaysUsed}, kategoria szczególna ${recUop.specialCategoryDays})`);

await prisma.$disconnect();
console.log(failures === 0 ? '\nNAKŁADKA L4 OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
