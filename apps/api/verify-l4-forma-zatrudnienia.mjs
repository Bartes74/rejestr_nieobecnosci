// FR-B5 — brak wpływu L4 na pulę urlopu dotyczy WYŁĄCZNIE UoP.
// Poza UoP (B2B/OUT) dzień choroby zjada ten sam budżet dni co urlop, więc nic nie wraca do puli.
// Zapis L4 przechodzi przy każdej formie — różni się wyłącznie to, co dzieje się z pulą.
// Daty stałe w 2026 — jak w pozostałych suitach; muszą leżeć w bieżącym okresie obu form.
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

const iso = (d) => d.toISOString().slice(0, 10);

await waitForApi();

const mk = (lg, role, emp) => prisma.employee.create({ data: { firstName: lg, lastName: 'FZ', email: `${lg}@fz.pl`, login: lg, role, employmentType: emp, startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop FZ' } });
const l4 = await prisma.absenceType.create({ data: { name: 'L4 FZ', affectsPool: false, specialCategory: true } });

const squad = await prisma.orgUnit.create({ data: { name: 'Squad FZ', type: 'SQUAD' } });
await mk('fzadmin', 'ADMIN', 'UOP');
const uop = await mk('fzuop', 'EMPLOYEE', 'UOP');
const ext = await mk('fzext', 'EMPLOYEE', 'OUT');
await prisma.orgUnitMembership.createMany({ data: [uop, ext].map((e) => ({ employeeId: e.id, orgUnitId: squad.id })) });

const aAdmin = as(await login('fzadmin', 'haslo123'));
const aUop = as(await login('fzuop', 'haslo123'));
const aExt = as(await login('fzext', 'haslo123'));

const post = (a, body) => a('/absences', { method: 'POST', body: JSON.stringify(body) });
const usedOf = async (a, id) => (await j(await a(`/employees/${id}/balance`))).used;

// --- UoP: L4 przykrywa dzień urlopu, dzień wraca do puli ---
await j(await post(aUop, { employeeId: uop.id, typeId: urlop.id, dateFrom: '2026-09-07', dateTo: '2026-09-11' }));
ok((await usedOf(aUop, uop.id)) === 5, 'UoP: urlop pn–pt → wykorzystano 5');
await j(await post(aUop, { employeeId: uop.id, typeId: l4.id, dateFrom: '2026-09-09', dateTo: '2026-09-09' }));
ok((await usedOf(aUop, uop.id)) === 4, 'UoP: L4 w środku urlopu → dzień wrócił do puli (4)');
const uopRows = await prisma.absence.findMany({ where: { employeeId: uop.id, typeId: urlop.id } });
ok(uopRows.length === 1 && iso(uopRows[0].dateFrom) === '2026-09-07' && iso(uopRows[0].dateTo) === '2026-09-11',
  'UoP: urlop nietknięty w bazie — przykrycie jest projekcją, nie cięciem');

// --- OUT: ten sam zapis przechodzi, ale puli nie zwalnia ---
const extUrlop = await j(await post(aExt, { employeeId: ext.id, typeId: urlop.id, dateFrom: '2026-09-07', dateTo: '2026-09-11' }));
ok((await usedOf(aExt, ext.id)) === 5, 'OUT: urlop pn–pt → wykorzystano 5');
ok((await post(aExt, { employeeId: ext.id, typeId: l4.id, dateFrom: '2026-09-09', dateTo: '2026-09-09' })).ok,
  'OUT: L4 na zaplanowanym urlopie → zapisuje się (choroby nie da się przełożyć)');
const extNadal = await prisma.absence.findUnique({ where: { id: extUrlop.id } });
ok(iso(extNadal.dateFrom) === '2026-09-07' && iso(extNadal.dateTo) === '2026-09-11', 'OUT: urlop po zapisie L4 bez zmian');
ok((await usedOf(aExt, ext.id)) === 5, 'OUT: pula bez zmian — zmienił się rodzaj dnia, nie ich liczba');

// --- OUT: L4 w wolnym terminie obciąża pulę jak każda inna nieobecność ---
await j(await post(aExt, { employeeId: ext.id, typeId: l4.id, dateFrom: '2026-09-14', dateTo: '2026-09-15' }));
ok((await usedOf(aExt, ext.id)) === 7, 'OUT: L4 poza urlopem obniża pulę (5 + 2 = 7)');
ok((await usedOf(aUop, uop.id)) === 4, 'UoP: to samo L4 puli nie rusza (nadal 4)');

// --- podgląd zgodny z zapisem po obu stronach ---
const pv = async (a, id, from, to) => j(await a(`/absences/preview?employeeId=${id}&from=${from}&to=${to}&typeId=${l4.id}`));
const pExt = await pv(aExt, ext.id, '2026-09-21', '2026-09-22');
ok(pExt.returnedDays === 0 && pExt.remainingAfter === pExt.remaining - pExt.workingDays, 'OUT: podgląd L4 nie obiecuje zwrotu, saldo maleje');
const pUop = await pv(aUop, uop.id, '2026-09-21', '2026-09-22');
ok(pUop.returnedDays === 0 && pUop.remainingAfter === pUop.remaining, 'UoP: podgląd L4 w wolnym terminie — saldo bez zmian');

// --- OUT: samo L4 potrafi przekroczyć pulę ---
const przekr = await post(aExt, { employeeId: ext.id, typeId: l4.id, dateFrom: '2026-10-01', dateTo: '2026-11-13' });
ok(przekr.status === 400 && (await przekr.text()).includes('Przekroczenie puli'), 'OUT: L4 ponad dostępne dni → 400 przekroczenie puli');

// --- FR-B10: konwersja działa przy obu formach, ale znaczy co innego ---
const extPrzed = await usedOf(aExt, ext.id);
const extDoKonw = await j(await post(aExt, { employeeId: ext.id, typeId: urlop.id, dateFrom: '2026-11-16', dateTo: '2026-11-17' }));
ok((await aAdmin(`/absences/${extDoKonw.id}/convert-to-l4`, { method: 'POST' })).ok, 'OUT: konwersja na L4 przechodzi');
ok((await usedOf(aExt, ext.id)) === extPrzed + 2, 'OUT: konwersja nie zwalnia dni — zmienia sam rodzaj');
const uopDoKonw = await j(await post(aUop, { employeeId: uop.id, typeId: urlop.id, dateFrom: '2026-09-21', dateTo: '2026-09-22' }));
ok((await aAdmin(`/absences/${uopDoKonw.id}/convert-to-l4`, { method: 'POST' })).ok, 'UoP: konwersja na L4 nadal działa');
ok((await usedOf(aUop, uop.id)) === 4, 'UoP: po konwersji dni wróciły do puli (nadal 4)');

// --- raport liczy tę samą pulę co licznik (dwie implementacje, jedna reguła) ---
const usage = await j(await aAdmin(`/reports/usage?unitId=${squad.id}`));
const extRow = usage.rows.find((r) => r.employeeId === ext.id);
const extBal = await j(await aAdmin(`/employees/${ext.id}/balance`));
ok(extRow.used === extBal.used && extRow.remaining === extBal.remaining, 'OUT: /reports/usage zgodny z /balance');

await prisma.$disconnect();
console.log(failures === 0 ? '\nL4 A FORMA ZATRUDNIENIA OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
