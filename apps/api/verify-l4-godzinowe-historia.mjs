// Uwaga zleceniodawcy (feedback001): całodniowy urlop 4.09 pokazywał w historii 0 dni, bo tego samego
// dnia stały dwa L4 godzinowe. Licznik liczył ten dzień jako wykorzystany (12), a wiersze sumowały się
// do 11 — dwie projekcje tej samej reguły FR-B5 rozjechały się. Przykrywa wyłącznie L4 całodniowe
// (jak w countOverlaidDays), a przykryty wiersz niesie flagę `coveredBySick`, żeby „0" miało słowo.
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

const mk = (lg, role, emp) => prisma.employee.create({ data: { firstName: lg, lastName: 'LG', email: `${lg}@lg.pl`, login: lg, role, employmentType: emp, startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Nieobecność LG' } });
const l4type = await prisma.absenceType.create({ data: { name: 'L4 LG', affectsPool: false, specialCategory: true } });
const tribe = await prisma.orgUnit.create({ data: { name: 'Tribe LG', type: 'TRIBE' } });
const squad = await prisma.orgUnit.create({ data: { name: 'Squad LG', type: 'SQUAD', parentId: tribe.id } });
const uop = await mk('lguop', 'EMPLOYEE', 'UOP');
const lider = await mk('lglider', 'LEADER', 'UOP');
await prisma.orgUnitMembership.createMany({ data: [{ employeeId: uop.id, orgUnitId: squad.id }, { employeeId: lider.id, orgUnitId: tribe.id }] });

const aUop = as(await login('lguop', 'haslo123'));
const aLider = as(await login('lglider', 'haslo123'));
const post = (a, body) => a('/absences', { method: 'POST', body: JSON.stringify(body) });
const usedOf = async (id) => (await j(await aUop(`/employees/${id}/balance`))).used;
const rowsOf = async (a, id) => j(await a(`/absences?employeeId=${id}`));
const d = (s) => new Date(s);
// L4 niepełnodniowe wstawiane wprost do bazy: API odrzuca takie wpisy od poprawki „L4 wyłącznie
// całodniowe", ale w bazach sprzed niej takie wiersze istnieją i historia ma je liczyć poprawnie.
const sickHours = (from) => prisma.absence.create({ data: { employeeId: uop.id, typeId: l4type.id, dateFrom: d(from), dateTo: d(from), dayPart: 'HOURS', hourFrom: '09:00', hourTo: '11:00' } });

// --- scenariusz zleceniodawcy: urlop całodniowy + dwa L4 godzinowe tego samego dnia ---
const u1 = await j(await post(aUop, { employeeId: uop.id, typeId: urlop.id, dateFrom: '2026-09-21', dateTo: '2026-09-25' }));
await sickHours('2026-09-21'); await sickHours('2026-09-21');
let rows = await rowsOf(aUop, uop.id);
const r1 = rows.find((r) => r.id === u1.id);
ok(r1.workingDays === 5, `urlop 21–25.09 z L4 godzinowym 21.09 pokazuje 5 dni (było 0) — jest ${r1.workingDays}`);
ok(r1.coveredBySick === false, 'L4 godzinowe nie oznacza urlopu jako przykrytego');
ok(rows.filter((r) => r.typeId === l4type.id).every((r) => r.workingDays === 0.25), 'każde L4 godzinowe 09–11 to 0,25 dnia');
ok((await usedOf(uop.id)) === 5, 'licznik: wykorzystano 5 — dzień z L4 godzinowym liczy się jako urlop, jak w wierszu');

// --- L4 całodniowe przykrywa: wiersz 0 i flaga ---
const u2 = await j(await post(aUop, { employeeId: uop.id, typeId: urlop.id, dateFrom: '2026-09-28', dateTo: '2026-09-29' }));
await j(await post(aUop, { employeeId: uop.id, typeId: l4type.id, dateFrom: '2026-09-28', dateTo: '2026-09-30' }));
rows = await rowsOf(aUop, uop.id);
const r2 = rows.find((r) => r.id === u2.id);
ok(r2.workingDays === 0 && r2.coveredBySick === true, 'urlop w całości pod L4 całodniowym: 0 dni i flaga „przykryte"');
ok((await usedOf(uop.id)) === 5, 'licznik bez zmian: dni pod L4 nie schodzą z puli');

// --- przykrycie częściowe ---
const u3 = await j(await post(aUop, { employeeId: uop.id, typeId: urlop.id, dateFrom: '2026-10-05', dateTo: '2026-10-07' }));
await j(await post(aUop, { employeeId: uop.id, typeId: l4type.id, dateFrom: '2026-10-06', dateTo: '2026-10-06' }));
rows = await rowsOf(aUop, uop.id);
const r3 = rows.find((r) => r.id === u3.id);
ok(r3.workingDays === 2 && r3.coveredBySick === true, 'urlop 3-dniowy z L4 w środku: 2 dni i flaga');
ok(rows.reduce((s, r) => s + (r.typeId === urlop.id ? r.workingDays : 0), 0) === (await usedOf(uop.id)), 'suma wierszy urlopu równa się licznikowi „wykorzystano"');

// --- lider bez VIEW_L4: flaga nie może wskazać, który z nakładających się wpisów jest L4 ---
const masked = await rowsOf(aLider, uop.id);
ok(masked.every((r) => r.typeId === null && r.coveredBySick === false), 'bez prawa do powodu: typ zamaskowany i flaga zawsze fałszywa');

await prisma.$disconnect();
console.log(failures === 0 ? '\nHISTORIA PRZY L4 GODZINOWYM OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
