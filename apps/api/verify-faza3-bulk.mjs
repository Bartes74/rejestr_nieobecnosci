// B2 / FR-A10 — operacje masowe: jedna nieobecność dla wielu osób, RBAC + walidacja egzekwowane per osoba,
// częściowy sukces (zbiórka błędów jak w imporcie). Lider działa w obrębie swojego Tribe.
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const tribeA = await prisma.orgUnit.create({ data: { name: 'TribeA BULK', type: 'TRIBE' } });
const squadA = await prisma.orgUnit.create({ data: { name: 'SquadA BULK', type: 'SQUAD', parentId: tribeA.id } });
const tribeB = await prisma.orgUnit.create({ data: { name: 'TribeB BULK', type: 'TRIBE' } });
const squadB = await prisma.orgUnit.create({ data: { name: 'SquadB BULK', type: 'SQUAD', parentId: tribeB.id } });
const mk = (first, lg, role) => prisma.employee.create({ data: { firstName: first, lastName: 'BLK', email: `${lg}@blk.pl`, login: lg, role, employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const lider = await mk('Lider', 'blklider', 'LEADER');
const anna = await mk('Anna', 'blkanna', 'EMPLOYEE');
const bartek = await mk('Bartek', 'blkbartek', 'EMPLOYEE');
const celina = await mk('Celina', 'blkcelina', 'EMPLOYEE');
const obcy = await mk('Obcy', 'blkobcy', 'EMPLOYEE');
await prisma.orgUnitMembership.createMany({ data: [
  { employeeId: lider.id, orgUnitId: squadA.id }, { employeeId: anna.id, orgUnitId: squadA.id },
  { employeeId: bartek.id, orgUnitId: squadA.id }, { employeeId: celina.id, orgUnitId: squadA.id },
  { employeeId: obcy.id, orgUnitId: squadB.id },
] });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop BULK' } });
// Anna ma już wpis w terminie → masowy zapis dla niej powinien się nie udać (kolizja), reszta OK.
await prisma.absence.create({ data: { employeeId: anna.id, typeId: urlop.id, dateFrom: new Date('2026-06-08'), dateTo: new Date('2026-06-09') } });

const aLider = as(await login('blklider', 'haslo123'));

// masowo dla 3 członków Tribe; Anna koliduje → created 2, errors 1 (Anna)
const r1 = await j(await aLider('/absences/bulk', { method: 'POST', body: JSON.stringify({ employeeIds: [anna.id, bartek.id, celina.id], typeId: urlop.id, dateFrom: '2026-06-08', dateTo: '2026-06-09' }) }));
ok(r1.created === 2 && r1.errors.length === 1, `masowo: utworzono 2, błąd 1 (created=${r1.created}, errors=${r1.errors.length})`);
ok(r1.errors[0]?.employeeId === anna.id && /[Kk]olizj/.test(r1.errors[0]?.message ?? ''), 'błąd dotyczy Anny (kolizja terminu)');
ok((await prisma.absence.count({ where: { employeeId: bartek.id } })) === 1 && (await prisma.absence.count({ where: { employeeId: celina.id } })) === 1, 'Bartek i Celina mają po 1 wpisie (częściowy sukces, bez rollbacku)');

// osoba spoza Tribe → wiersz błędu (RBAC per osoba), nic nie utworzone
const r2 = await j(await aLider('/absences/bulk', { method: 'POST', body: JSON.stringify({ employeeIds: [obcy.id], typeId: urlop.id, dateFrom: '2026-06-15', dateTo: '2026-06-15' }) }));
ok(r2.created === 0 && r2.errors.length === 1, 'masowo spoza Tribe → 0 utworzonych, 1 błąd (RBAC per osoba)');
ok((await prisma.absence.count({ where: { employeeId: obcy.id } })) === 0, 'osoba spoza Tribe bez wpisu');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 3 (operacje masowe A10) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
