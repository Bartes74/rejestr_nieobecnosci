// Faza 2: FR-F5 „kto zalega" + FR-A5 korekty lidera (w obrębie Tribe) z audytem.
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

const tribeA = await prisma.orgUnit.create({ data: { name: 'TribeA F2', type: 'TRIBE' } });
const squadA = await prisma.orgUnit.create({ data: { name: 'SquadA F2', type: 'SQUAD', parentId: tribeA.id } });
const tribeB = await prisma.orgUnit.create({ data: { name: 'TribeB F2', type: 'TRIBE' } });
const squadB = await prisma.orgUnit.create({ data: { name: 'SquadB F2', type: 'SQUAD', parentId: tribeB.id } });
const mk = (first, login, role) => prisma.employee.create({ data: { firstName: first, lastName: 'F2', email: `${login}@f2.pl`, login, role, employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
await mk('Adm', 'f2admin', 'ADMIN');
const lider = await mk('Lider', 'f2lider', 'LEADER');
const anna = await mk('Anna', 'f2anna2', 'EMPLOYEE');
const celina = await mk('Celina', 'f2celina', 'EMPLOYEE');
await prisma.orgUnitMembership.createMany({ data: [
  { employeeId: lider.id, orgUnitId: squadA.id },
  { employeeId: anna.id, orgUnitId: squadA.id },
  { employeeId: celina.id, orgUnitId: squadB.id },
] });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop F2b' } });
await prisma.leaveAllowance.create({ data: { employeeId: anna.id, periodYear: 2026, baseDays: 26, carriedOver: 4 } }); // zaległy
const annaAbs = await prisma.absence.create({ data: { employeeId: anna.id, typeId: urlop.id, dateFrom: new Date('2026-06-08'), dateTo: new Date('2026-06-09') } });
const celinaAbs = await prisma.absence.create({ data: { employeeId: celina.id, typeId: urlop.id, dateFrom: new Date('2026-06-08'), dateTo: new Date('2026-06-09') } });

const aAdmin = as(await login('f2admin', 'haslo123'));
const aLider = as(await login('f2lider', 'haslo123'));

// --- FR-F5: kto zalega ---
const overdue = await j(await aAdmin(`/reports/overdue?unitId=${squadA.id}`));
const annaRow = overdue.rows.find((r) => r.employeeId === anna.id);
ok(annaRow?.zalega === true && annaRow?.carriedOver === 4, 'kto zalega: Anna oznaczona (zaległe 4)');

// --- FR-A5: lider koryguje wpis w swoim Tribe + audyt ---
ok((await aLider(`/absences/${annaAbs.id}`, { method: 'PATCH', body: JSON.stringify({ dateTo: '2026-06-10' }) })).ok, 'lider koryguje wpis Anny (swój Tribe) → ok');
ok(!!(await prisma.auditLog.findFirst({ where: { action: 'ABSENCE_UPDATE', userId: lider.id, description: { contains: 'w imieniu' } } })), 'korekta lidera odnotowana w audycie (FR-A5/I1)');

// --- lider NIE może edytować spoza Tribe ---
ok((await aLider(`/absences/${celinaAbs.id}`, { method: 'PATCH', body: JSON.stringify({ dateTo: '2026-06-10' }) })).status === 403, 'lider nie koryguje wpisu spoza Tribe → 403');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 2 (zalega + lider) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
