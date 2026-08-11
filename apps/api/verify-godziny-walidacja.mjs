// FR-A3 (regresja bezpieczeństwa): wpis godzinowy bez sensownego zakresu godzin.
//
// Ułamek dnia z takiego wpisu wynosił zero albo NaN. Zero dawało nieobecność widoczną
// w kalendarzu, która nie zabierała nic z puli — czyli urlop bez kosztu, powtarzalny bez
// ograniczeń. NaN był gorszy: wchodził do sumy wykorzystanych dni, zamieniał saldo osoby
// w NaN (w JSON `null`) i wyłączał kontrolę przekroczenia puli, bo `NaN > cokolwiek` to fałsz.
// Naprawa wymagała ręcznego usunięcia wiersza z bazy.
//
// Suita pilnuje trzech warstw naraz: formatu w DTO, warunku w AbsencesService.validate
// (jednego dla zapisu i edycji) oraz zacisku 0–1 w dayFraction.
import { API, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

const emp = await prisma.employee.create({ data: { firstName: 'GW', lastName: 'Anna', email: 'gwanna@x.pl', login: 'gwanna', role: 'EMPLOYEE', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop GW' } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });

const tok = await login('gwanna', 'haslo123');
const post = (p, b) => fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify(b) });
const patch = (p, b) => fetch(API + p, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify(b) });
const get = (p) => fetch(API + p, { headers: { authorization: `Bearer ${tok}` } });
const wpis = (extra) => ({ employeeId: emp.id, typeId: urlop.id, dateFrom: '2026-06-08', dateTo: '2026-06-08', ...extra });

// --- ZAPIS ---------------------------------------------------------------------------------
ok((await post('/absences', wpis({ dayPart: 'HOURS' }))).status === 400, 'HOURS bez godzin → 400');
ok((await post('/absences', wpis({ dayPart: 'HOURS', hourFrom: '09:00' }))).status === 400, 'HOURS tylko z godziną początkową → 400');
ok((await post('/absences', wpis({ dayPart: 'HOURS', hourFrom: '17:00', hourTo: '09:00' }))).status === 400, 'HOURS z zakresem odwróconym → 400');
ok((await post('/absences', wpis({ dayPart: 'HOURS', hourFrom: '09:00', hourTo: '09:00' }))).status === 400, 'HOURS z zakresem zerowym → 400');
ok((await post('/absences', wpis({ dayPart: 'HOURS', hourFrom: 'abc', hourTo: 'def' }))).status === 400, 'HOURS ze śmieciami zamiast godzin → 400 (walidacja formatu w DTO)');
ok((await post('/absences', wpis({ dayPart: 'HOURS', hourFrom: '9:00', hourTo: '13:00' }))).status === 400, 'HOURS bez wiodącego zera → 400 (format HH:MM)');
ok((await post('/absences', wpis({ dayPart: 'HOURS', hourFrom: '25:00', hourTo: '26:00' }))).status === 400, 'HOURS z godziną spoza doby → 400');

// Żadna z powyższych prób nie mogła niczego zapisać.
ok((await j(await get(`/absences?employeeId=${emp.id}`))).length === 0, 'po odrzuconych próbach historia jest pusta');

// --- SALDO ---------------------------------------------------------------------------------
// Asercja pilnująca konkretnie regresji NaN: uszkodzone saldo serializuje się do `null`.
const wpisOk = await j(await post('/absences', wpis({ dayPart: 'HOURS', hourFrom: '09:00', hourTo: '13:00' })));
let bal = await j(await get(`/employees/${emp.id}/balance`));
ok(typeof bal.used === 'number' && Number.isFinite(bal.used), 'saldo pozostaje liczbą (nie null/NaN)');
ok(bal.used === 0.5, '09:00–13:00 = 0.5 dnia');
ok(bal.remaining === 25.5, 'pozostało 25.5 (26 − 0.5)');

// --- EDYCJA (PATCH) ------------------------------------------------------------------------
// Przestawienie wpisu całodniowego na HOURS zostawiało godziny puste — ta sama luka, innym wejściem.
const caly = await j(await post('/absences', wpis({ dateFrom: '2026-06-10', dateTo: '2026-06-10' })));
ok((await patch(`/absences/${caly.id}`, { dayPart: 'HOURS' })).status === 400, 'PATCH całodniowy → HOURS bez godzin → 400');

// Poprawka godzin ma faktycznie zmieniać wpis, a nie wracać jako sukces bez efektu.
const zmieniony = await j(await patch(`/absences/${wpisOk.id}`, { hourFrom: '09:00', hourTo: '17:00' }));
ok(zmieniony.hourFrom === '09:00' && zmieniony.hourTo === '17:00', 'PATCH godzin zapisuje nowe wartości');
bal = await j(await get(`/employees/${emp.id}/balance`));
ok(bal.used === 2, 'po zmianie na 09:00–17:00 wpis liczy się jako pełny dzień (1 + 1 całodniowy)');

// Godziny należą wyłącznie do wpisu godzinowego — inaczej zostają jako martwy stan.
const naCaly = await j(await patch(`/absences/${wpisOk.id}`, { dayPart: 'FULL' }));
ok(naCaly.hourFrom === null && naCaly.hourTo === null, 'PATCH HOURS → FULL zeruje godziny');

// --- ODPORNOŚĆ NA POWTÓRZENIA --------------------------------------------------------------
// Sedno luki: dwadzieścia prób „darmowego" wpisu nie może ruszyć salda ani zostawić śladu.
const przed = (await j(await get(`/employees/${emp.id}/balance`))).used;
await Promise.all(Array.from({ length: 20 }, (_, i) =>
  post('/absences', wpis({ dateFrom: `2026-07-${String(i + 1).padStart(2, '0')}`, dateTo: `2026-07-${String(i + 1).padStart(2, '0')}`, dayPart: 'HOURS' }))));
const po = await j(await get(`/employees/${emp.id}/balance`));
ok(po.used === przed, '20 prób wpisu bez godzin nie zmienia wykorzystania');
ok(Number.isFinite(po.remaining), 'saldo nadal jest liczbą po serii odrzuconych żądań');

await prisma.$disconnect();
console.log(failures === 0 ? '\nWALIDACJA GODZIN OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
