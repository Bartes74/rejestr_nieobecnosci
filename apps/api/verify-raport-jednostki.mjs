// Raport dyrektora (feedback002): statystyki per Tribe/zespół i departament jako suma — osoby, pula
// z zaległymi, zaplanowano (cały okres), zrealizowano (do dziś), pozostało, ilu zalega. „Zalega"
// = pozostało ≥ próg z Konfiguracji; wcześniej próg nie miał widocznego skutku, a RAZEM pomijał zaległe.
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';
import { todayUtc } from '../../packages/core/dist/today.js';

await waitForApi();

const Y = todayUtc().getUTCFullYear();
const mk = (lg, role) => prisma.employee.create({ data: { firstName: lg, lastName: 'RJ', email: `${lg}@rj.pl`, login: lg, role, employmentType: 'UOP', startDate: new Date(Date.UTC(Y, 0, 1)), passwordHash: hashPassword('haslo123') } });
await prisma.adminSetting.deleteMany({ where: { key: { startsWith: 'leavePool.' } } });
await prisma.adminSetting.create({ data: { key: 'leavePool.default', value: '26' } });
await prisma.adminSetting.deleteMany({ where: { key: 'overdue.threshold' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop RJ' } });
const tribe = await prisma.orgUnit.create({ data: { name: 'Tribe RJ', type: 'TRIBE' } });
const s1 = await prisma.orgUnit.create({ data: { name: 'Squad RJ-1', type: 'SQUAD', parentId: tribe.id } });
const s2 = await prisma.orgUnit.create({ data: { name: 'Squad RJ-2', type: 'SQUAD', parentId: tribe.id } });
await mk('rjadmin', 'ADMIN');
const a = await mk('rja', 'EMPLOYEE');
const b = await mk('rjb', 'EMPLOYEE');
await prisma.orgUnitMembership.createMany({ data: [{ employeeId: a.id, orgUnitId: s1.id }, { employeeId: b.id, orgUnitId: s2.id }] });
await prisma.leaveAllowance.create({ data: { employeeId: b.id, periodYear: Y, baseDays: 26, carriedOver: 4 } });

// Daty: drugi pełny tydzień stycznia (pon–pt, po Trzech Królach) — przeszłość; poniedziałek–wtorek
// po 20 grudnia — przyszłość, chyba że test biegnie w końcu grudnia (wtedy liczy się jako zrealizowane).
const mondayAfter = (m, day) => { const x = new Date(Date.UTC(Y, m, day)); x.setUTCDate(x.getUTCDate() + ((8 - x.getUTCDay()) % 7)); return x; };
const isoOf = (dt) => dt.toISOString().slice(0, 10);
const plus = (dt, n) => { const x = new Date(dt); x.setUTCDate(x.getUTCDate() + n); return x; };
const jan = mondayAfter(0, 8), dec = mondayAfter(11, 20), feb = mondayAfter(1, 8);
const decPast = dec <= todayUtc();
await prisma.absence.createMany({ data: [
  { employeeId: a.id, typeId: urlop.id, dateFrom: jan, dateTo: plus(jan, 4) }, // 5 dni, przeszłość
  { employeeId: a.id, typeId: urlop.id, dateFrom: dec, dateTo: plus(dec, 1) }, // 2 dni, zwykle przyszłość
  { employeeId: b.id, typeId: urlop.id, dateFrom: feb, dateTo: plus(feb, 1) }, // 2 dni, przeszłość
] });

const aAdmin = as(await login('rjadmin', 'haslo123'));
const tree = await j(await aAdmin(`/reports/tree?unitId=${tribe.id}`));
const usage = await j(await aAdmin(`/reports/usage?unitId=${tribe.id}`));
const k1 = tree.children.find((c) => c.id === s1.id), k2 = tree.children.find((c) => c.id === s2.id);

ok(k1?.headcount === 1 && k1?.pool === 26 && k1?.carriedOver === 0 && k1?.used === 7, `S1: 1 osoba, pula 26, zaplanowano 7 (jest ${k1?.used})`);
ok(k1?.realized === (decPast ? 7 : 5), `S1: zrealizowano do dziś ${decPast ? 7 : 5} (grudzień ${decPast ? 'już był' : 'jeszcze przed nami'})`);
ok(k1?.remaining === 19, 'S1: pozostało 19');
ok(k2?.headcount === 1 && k2?.pool === 26 && k2?.carriedOver === 4 && k2?.used === 2 && k2?.realized === 2 && k2?.remaining === 28, 'S2: pula 26 + 4 zaległe, zaplanowano 2, pozostało 28');
ok(tree.headcount === 2 && tree.pool === 52 && tree.carriedOver === 4 && tree.used === 9 && tree.remaining === 47, 'Tribe = suma squadów (52 / 4 / 9 / 47)');
ok(tree.overdueCount === 2 && k1?.overdueCount === 1 && k2?.overdueCount === 1, 'próg 10: zalegają oboje (19 i 28 pozostało)');
ok(usage.totals.carriedOver === 4 && usage.totals.pool + usage.totals.carriedOver === 56 && usage.totals.realized === tree.realized, 'RAZEM w raporcie niesie zaległe (56 = 52 + 4) i zrealizowano');
const rowB = usage.rows.find((r) => r.employeeId === b.id);
ok(rowB?.realized === 2 && rowB?.used === 2, 'wiersz osoby ma zaplanowano i zrealizowano');

// próg z Konfiguracji naprawdę steruje „zalega": 30 → nikt, mimo że b ma 4 dni zaległe
await j(await aAdmin('/settings/overdue.threshold', { method: 'PUT', body: JSON.stringify({ value: 30 }) }));
const tree30 = await j(await aAdmin(`/reports/tree?unitId=${tribe.id}`));
const over30 = await j(await aAdmin(`/reports/overdue?unitId=${tribe.id}`));
ok(tree30.overdueCount === 0 && over30.rows.length === 0 && over30.threshold === 30, 'próg 30: nikt nie zalega — zaległe z poprzednich okresów nie wystarczają same');
await j(await aAdmin('/settings/overdue.threshold', { method: 'PUT', body: JSON.stringify({ value: 20 }) }));
const over20 = await j(await aAdmin(`/reports/overdue?unitId=${tribe.id}`));
ok(over20.rows.length === 1 && over20.rows[0].employeeId === b.id && over20.rows[0].zalega === true, 'próg 20: zalega tylko b (28 pozostało), posortowane po pozostało');

// Sprzątanie: kolejne suity zakładają domyślny próg (10).
await prisma.adminSetting.deleteMany({ where: { key: 'overdue.threshold' } });

await prisma.$disconnect();
console.log(failures === 0 ? '\nRAPORT JEDNOSTEK OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
