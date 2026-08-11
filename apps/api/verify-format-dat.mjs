// Jeden zapis daty kalendarzowej na wszystkich endpointach: `YYYY-MM-DD`.
// Rozjazd `/absences` (pełne znaczniki czasu) kontra `/calendar` (sama data) kosztował
// kilkanaście obejść `slice(0, 10)` we froncie i wywrócił mini-kalendarz wpisu, bo
// doklejenie `T00:00:00Z` do wartości zakończonej strefą daje `Invalid Date` po cichu.
import { API, as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

// Data kalendarzowa: dokładnie dziesięć znaków, bez litery „T" i bez strefy.
const DATE = /^\d{4}-\d{2}-\d{2}$/;

await waitForApi();

const mk = (login, role) => prisma.employee.create({ data: { firstName: login, lastName: 'FD', email: `${login}@x.pl`, login, role, employmentType: 'UOP', startDate: new Date('2020-01-01'), passwordHash: hashPassword('haslo123') } });
const admin = await mk('fdadmin', 'ADMIN');
const emp = await mk('fdemp', 'EMPLOYEE');
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop FD' } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });

const a = as(await login('fdemp', 'haslo123'));
const aAdmin = as(await login('fdadmin', 'haslo123'));

const FROM = '2026-09-07', TO = '2026-09-11';

// zapis — odpowiedź POST /absences
const created = await j(await a('/absences', { method: 'POST', body: JSON.stringify({ employeeId: emp.id, typeId: urlop.id, dateFrom: FROM, dateTo: TO }) }));
ok(created.dateFrom === FROM && created.dateTo === TO, `POST /absences oddaje daty jak przyszły (${created.dateFrom}–${created.dateTo})`);

// odczyt — GET /absences
const [listed] = await j(await a(`/absences?employeeId=${emp.id}`));
ok(DATE.test(listed.dateFrom) && DATE.test(listed.dateTo), `GET /absences: sama data (${listed.dateFrom}–${listed.dateTo})`);

// ten sam wpis widziany przez /calendar — oba endpointy muszą mówić o tym dniu tak samo
const [cal] = await j(await a(`/calendar?from=${FROM}&to=${TO}`));
ok(cal.dateFrom === listed.dateFrom && cal.dateTo === listed.dateTo, '/calendar i /absences zapisują ten sam dzień identycznie');

// zmiana terminu — PATCH /absences/:id
const moved = await j(await a(`/absences/${created.id}`, { method: 'PATCH', body: JSON.stringify({ dateFrom: '2026-09-14', dateTo: '2026-09-15' }) }));
ok(moved.dateFrom === '2026-09-14' && moved.dateTo === '2026-09-15', `PATCH /absences oddaje samą datę (${moved.dateFrom}–${moved.dateTo})`);

// sprinty
const sprint = await j(await aAdmin('/sprints', { method: 'POST', body: JSON.stringify({ name: 'Sprint FD', dateFrom: '2026-09-07', dateTo: '2026-09-18' }) }));
ok(sprint.dateFrom === '2026-09-07' && sprint.dateTo === '2026-09-18', `POST /sprints: sama data (${sprint.dateFrom}–${sprint.dateTo})`);
const sprinty = await j(await a('/sprints'));
ok(sprinty.every((s) => DATE.test(s.dateFrom) && DATE.test(s.dateTo)), 'GET /sprints: same daty na całej liście');

// święta
const cal2 = await j(await aAdmin('/holiday-calendars', { method: 'POST', body: JSON.stringify({ name: 'Kalendarz FD' }) }));
const swieto = await j(await aAdmin('/holidays', { method: 'POST', body: JSON.stringify({ calendarId: cal2.id, date: '2026-11-11', name: 'Święto FD' }) }));
ok(swieto.date === '2026-11-11', `POST /holidays: sama data (${swieto.date})`);
await j(await aAdmin(`/holiday-calendars/${cal2.id}/import-pl?year=2026`, { method: 'POST' }));
const swieta = await j(await a(`/holidays?calendarId=${cal2.id}`));
ok(swieta.length > 0 && swieta.every((h) => DATE.test(h.date)), `GET /holidays: same daty (${swieta.length} dni)`);

// najważniejsze: wartość z API da się użyć wprost w arytmetyce dat, bez obcinania
const utc = new Date(`${listed.dateFrom}T00:00:00.000Z`);
ok(!Number.isNaN(utc.getTime()), 'data z API + „T00:00:00Z" to poprawny moment, nie Invalid Date');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFORMAT DAT OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
