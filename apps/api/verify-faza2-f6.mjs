// Faza 2: FR-F6 — stabilny, wersjonowany eksport dla płac/PMO (RODO-safe).
import { API, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

const as = (t) => (p, o = {}) => fetch(API + p, { ...o, headers: { authorization: `Bearer ${t}`, ...(o.headers || {}) } });

await waitForApi();

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

// FR-J1 — eksport jest drugą drogą, którą znacznik kategorii szczególnej wychodzi z systemu.
// Deklaracja „każdy uprawniony odczyt trafia do audytu" obejmuje więc i ten odczyt.
const audit = await j(await aAdmin(`/audit?entity=Report&action=VIEW_TYPES&entityId=${squad.id}`));
// Powyżej eksport pobrali admin (widzi L4) i PMO (nie widzi) — ślad ma zostać po jednym z nich.
// Wpis po odczycie PMO byłby fałszywym tropem w dzienniku, brak wpisu po odczycie admina — luką.
ok(audit.length === 1 && audit[0].userId, 'odczyt L4 w eksporcie płac zapisany w audycie (VIEW_TYPES), eksport bez uprawnienia — nie');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 2 (eksport płac F6) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
