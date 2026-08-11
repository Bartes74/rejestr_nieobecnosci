// Faza 3 (pkt 1–2): FR-A5 ekran „Zespół" (my-team + L4-safe lista wpisów lidera)
// oraz import .xlsx z konfigurowalnym mapowaniem kolumn (FR-G5/D4).
import { API, as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';
import ExcelJS from 'exceljs';

await waitForApi();

// struktura: dwa Tribe; lider i Anna w TribeA, Obcy w TribeB
const tribeA = await prisma.orgUnit.create({ data: { name: 'TribeA F3', type: 'TRIBE' } });
const squadA = await prisma.orgUnit.create({ data: { name: 'SquadA F3', type: 'SQUAD', parentId: tribeA.id } });
const tribeB = await prisma.orgUnit.create({ data: { name: 'TribeB F3', type: 'TRIBE' } });
const squadB = await prisma.orgUnit.create({ data: { name: 'SquadB F3', type: 'SQUAD', parentId: tribeB.id } });
const mk = (first, lg, role) => prisma.employee.create({ data: { firstName: first, lastName: 'F3', email: `${lg}@f3.pl`, login: lg, role, employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const admin = await mk('Adm', 'f3admin', 'ADMIN');
const lider = await mk('Lider', 'f3lider', 'LEADER');
const anna = await mk('Anna', 'f3anna', 'EMPLOYEE');
const obcy = await mk('Obcy', 'f3obcy', 'EMPLOYEE');
await prisma.orgUnitMembership.createMany({ data: [
  { employeeId: lider.id, orgUnitId: squadA.id },
  { employeeId: anna.id, orgUnitId: squadA.id },
  { employeeId: obcy.id, orgUnitId: squadB.id },
] });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop F3' } });
const l4 = await prisma.absenceType.create({ data: { name: 'L4 F3', affectsPool: false, specialCategory: true } });
const annaUrlop = await prisma.absence.create({ data: { employeeId: anna.id, typeId: urlop.id, dateFrom: new Date('2026-06-08'), dateTo: new Date('2026-06-09') } });
await prisma.absence.create({ data: { employeeId: anna.id, typeId: l4.id, dateFrom: new Date('2026-07-06'), dateTo: new Date('2026-07-07') } });

const adminToken = await login('f3admin', 'haslo123');
const aAdmin = as(adminToken);
const aLider = as(await login('f3lider', 'haslo123'));

// --- FR-A5: „mój zespół" lidera ---
const team = await j(await aLider('/org/my-team'));
ok(team.some((e) => e.id === anna.id), 'my-team lidera zawiera Annę (jego Tribe)');
ok(!team.some((e) => e.id === obcy.id), 'my-team lidera NIE zawiera osoby z innego Tribe');
ok(!team.some((e) => e.id === lider.id), 'my-team lidera nie zawiera samego lidera');

// --- FR-A5 + L4: lider widzi wpisy Anny, ale typy ZAMASKOWANE (L4 nieodróżnialne) ---
const annaAbs = await j(await aLider(`/absences?employeeId=${anna.id}`));
ok(annaAbs.length === 2, 'lider widzi 2 wpisy Anny');
ok(annaAbs.every((a) => a.type.name === 'Nieobecność' && a.type.id === null && a.typeId === null),
  'typy zamaskowane — L4 nieodróżnialne dla lidera bez VIEW_L4 (D2/H3)');

// --- lider NIE widzi wpisów spoza Tribe ---
ok((await aLider(`/absences?employeeId=${obcy.id}`)).status === 403, 'lider nie odczyta wpisów spoza Tribe → 403');

// --- admin (VIEW_L4) widzi prawdziwe typy, z audytem (FR-J1) ---
const annaAbsAdmin = await j(await aAdmin(`/absences?employeeId=${anna.id}`));
ok(annaAbsAdmin.some((a) => a.type.name === 'L4 F3'), 'admin widzi prawdziwy typ L4');
ok(!!(await prisma.auditLog.findFirst({ where: { action: 'VIEW_TYPES', userId: admin.id, entityId: anna.id } })),
  'odczyt typów przez admina odnotowany w audycie (FR-J1)');

// --- lider koryguje termin wpisu Anny (w imieniu, z audytem) ---
ok((await aLider(`/absences/${annaUrlop.id}`, { method: 'PATCH', body: JSON.stringify({ dateTo: '2026-06-10' }) })).ok, 'lider koryguje termin wpisu Anny → ok');

// --- FR-G5/D4: import .xlsx z NIESTANDARDOWYMI nagłówkami + mapowaniem kolumn ---
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Pracownicy');
ws.addRow(['First', 'Last', 'Mail', 'Username', 'Type', 'Start']);
ws.addRow(['Jan', 'Importowy', 'jan.import@f3.pl', 'jimport', 'UOP', '2026-02-01']);
const buf = await wb.xlsx.writeBuffer();
const fd = new FormData();
fd.append('file', new Blob([buf]), 'prac.xlsx');
fd.append('mapping', JSON.stringify({ firstName: 'First', lastName: 'Last', email: 'Mail', login: 'Username', employmentType: 'Type', startDate: 'Start' }));
const impRes = await j(await fetch(`${API}/employees/import`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: fd }));
ok(impRes.created === 1 && impRes.errors.length === 0, 'import z mapowaniem niestandardowych nagłówków → utworzono 1, bez błędów');
ok(!!(await prisma.employee.findUnique({ where: { email: 'jan.import@f3.pl' } })), 'zaimportowany pracownik istnieje w bazie');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 3 (zespół + import) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
