// Lider jednostki (feedback002, widok dyrektora): dyrektor albo admin wskazuje lidera Tribe'u/departamentu,
// a kalendarz zespołu potrafi zawęzić widok do jednostki i do samych liderów. Kanał kalendarza
// pozostaje bez typów nieobecności (D1/D2, L4-safe).
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

const mk = (lg, role) => prisma.employee.create({ data: { firstName: lg, lastName: 'LJ', email: `${lg}@lj.pl`, login: lg, role, employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const pion = await prisma.orgUnit.create({ data: { name: 'Pion LJ', type: 'PION' } });
const dept = await prisma.orgUnit.create({ data: { name: 'Dept LJ', type: 'DEPARTAMENT', parentId: pion.id } });
const tribeA = await prisma.orgUnit.create({ data: { name: 'Tribe LJ-A', type: 'TRIBE', parentId: dept.id } });
const tribeB = await prisma.orgUnit.create({ data: { name: 'Tribe LJ-B', type: 'TRIBE', parentId: dept.id } });
const squadA = await prisma.orgUnit.create({ data: { name: 'Squad LJ-A1', type: 'SQUAD', parentId: tribeA.id } });
const squadB = await prisma.orgUnit.create({ data: { name: 'Squad LJ-B1', type: 'SQUAD', parentId: tribeB.id } });
await mk('ljadmin', 'ADMIN'); await mk('ljdyr', 'DIRECTOR');
const liderA = await mk('ljliderA', 'LEADER');
const empA = await mk('ljempA', 'EMPLOYEE');
const empB = await mk('ljempB', 'EMPLOYEE');
await prisma.orgUnitMembership.createMany({ data: [
  { employeeId: liderA.id, orgUnitId: tribeA.id }, { employeeId: empA.id, orgUnitId: squadA.id }, { employeeId: empB.id, orgUnitId: squadB.id },
] });
const l4 = await prisma.absenceType.create({ data: { name: 'L4 LJ', affectsPool: false, specialCategory: true } });
await prisma.absence.create({ data: { employeeId: empA.id, typeId: l4.id, dateFrom: new Date('2026-10-05'), dateTo: new Date('2026-10-06') } });

const aAdmin = as(await login('ljadmin', 'haslo123'));
const aDyr = as(await login('ljdyr', 'haslo123'));
const aLider = as(await login('ljliderA', 'haslo123'));
const patch = (a, unitId, leaderId) => a(`/org/units/${unitId}/leader`, { method: 'PATCH', body: JSON.stringify({ leaderId }) });

// --- kto może wskazać lidera i kogo ---
ok((await patch(aDyr, tribeA.id, empA.id)).ok, 'dyrektor wskazuje lidera Tribe A → 200');
const units = await j(await aDyr('/org/units'));
ok(units.find((u) => u.id === tribeA.id)?.leaderId === empA.id, 'GET /org/units niesie leaderId');
ok((await prisma.auditLog.count({ where: { action: 'UNIT_LEADER_SET', entityId: tribeA.id, subjectId: empA.id } })) === 1, 'wskazanie lidera odnotowane w audycie');
ok((await patch(aLider, tribeA.id, liderA.id)).status === 403, 'lider (rola konta) nie wskazuje lidera jednostki → 403');
ok((await patch(aAdmin, tribeA.id, empB.id)).status === 400, 'osoba spoza poddrzewa → 400');
ok((await patch(aAdmin, dept.id, empB.id)).ok, 'admin wskazuje lidera departamentu spośród całego poddrzewa → 200');
ok((await patch(aAdmin, 'nie-ma-takiej', empA.id)).status === 404, 'nieistniejąca jednostka → 404');

// --- kandydaci: członkowie poddrzewa, w zasięgu pytającego ---
const kand = await j(await aLider(`/org/units/${tribeA.id}/members`));
ok(kand.some((e) => e.id === empA.id) && !kand.some((e) => e.id === empB.id), 'kandydaci Tribe A = poddrzewo A (bez osób z B)');
ok((await aLider(`/org/units/${tribeB.id}/members`)).status === 403, 'lider A nie pyta o kandydatów Tribe B → 403');

// --- kalendarz zespołu: unitId, leadersOnly, leaderOf, bez typów ---
const all = await j(await aAdmin(`/calendar/team?from=2026-10-05&to=2026-10-09`));
ok(all.people.find((p) => p.id === empA.id)?.leaderOf?.includes('Tribe LJ-A'), 'leaderOf wymienia jednostki, których osoba jest liderem');
ok(all.people.find((p) => p.id === empB.id)?.leaderOf?.length === 1, 'lider departamentu ma leaderOf z jedną jednostką');
const onlyA = await j(await aAdmin(`/calendar/team?from=2026-10-05&to=2026-10-09&unitId=${tribeA.id}`));
ok(onlyA.people.every((p) => [liderA.id, empA.id].includes(p.id)) && onlyA.people.length === 2, 'unitId zawęża do poddrzewa jednostki');
const leaders = await j(await aAdmin(`/calendar/team?from=2026-10-05&to=2026-10-09&leadersOnly=true`));
ok(leaders.people.length === 2 && leaders.people.every((p) => p.leaderOf.length > 0), 'leadersOnly zostawia wyłącznie liderów');
ok((await aLider(`/calendar/team?from=2026-10-05&to=2026-10-09&unitId=${tribeB.id}`)).status === 403, 'lider A z unitId Tribe B → 403 (zawężenie nigdy nie poszerza zasięgu)');
const dyrView = await j(await aDyr(`/calendar/team?from=2026-10-05&to=2026-10-09&leadersOnly=true`));
ok(dyrView.absences.length >= 1 && dyrView.absences.every((x) => !('type' in x) && !('typeId' in x)), 'L4 lidera w kalendarzu dyrektora bez typu i bez typeId (L4-safe)');

// --- czyszczenie wskazania ---
ok((await patch(aDyr, tribeA.id, null)).ok, 'leaderId: null czyści wskazanie');
ok((await j(await aDyr('/org/units'))).find((u) => u.id === tribeA.id)?.leaderId === null, 'po wyczyszczeniu leaderId = null');

await prisma.$disconnect();
console.log(failures === 0 ? '\nLIDER JEDNOSTKI OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
