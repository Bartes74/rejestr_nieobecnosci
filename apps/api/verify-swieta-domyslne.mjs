// Uwaga zleceniodawcy (feedback002): urlop 9–13.11 liczył się jako 5 dni, choć 11.11 to święto. Kalendarz
// „Polska" istniał, ale był pusty, a osoba bez przypisanego kalendarza nie korzystała z domyślnego.
// Teraz: kalendarz domyślny dostaje święta PL na bieżący i następny rok (ensure-pl, to samo co
// nocne zadanie schedulera), a osoba bez własnego kalendarza liczy dni wg domyślnego — w liczniku,
// historii, raporcie i capacity. Własny kalendarz nadal wygrywa (inne lokalizacje, FR-G7).
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';
import { polishHolidays } from '../../packages/core/dist/holidays-pl.js';
import { todayUtc } from '../../packages/core/dist/today.js';

await waitForApi();

const mk = (lg, role, extra = {}) => prisma.employee.create({ data: { firstName: lg, lastName: 'SD', email: `${lg}@sd.pl`, login: lg, role, employmentType: 'UOP', startDate: new Date('2020-01-01'), passwordHash: hashPassword('haslo123'), ...extra } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop SD' } });
const tribe = await prisma.orgUnit.create({ data: { name: 'Tribe SD', type: 'TRIBE' } });
const squad = await prisma.orgUnit.create({ data: { name: 'Squad SD', type: 'SQUAD', parentId: tribe.id } });
await mk('sdadmin', 'ADMIN');
const bez = await mk('sdbez', 'EMPLOYEE'); // bez kalendarza → domyślny
await prisma.orgUnitMembership.create({ data: { employeeId: bez.id, orgUnitId: squad.id } });
const aAdmin = as(await login('sdadmin', 'haslo123'));
const post = (p, body) => aAdmin(p, { method: 'POST', body: JSON.stringify(body) });

// --- kalendarz domyślny + ensure-pl (odpowiednik nocnego zadania) ---
ok((await aAdmin('/holiday-calendars/default/ensure-pl', { method: 'POST' })).status === 404, 'bez kalendarza domyślnego ensure-pl → 404');
const cal = await j(await post('/holiday-calendars', { name: 'Polska SD', isDefault: true }));
const first = await j(await aAdmin('/holiday-calendars/default/ensure-pl', { method: 'POST' }));
ok(first.calendarId === cal.id && first.added === 28, `ensure-pl dopisał święta na dwa lata (${first.added})`);
ok((await j(await aAdmin('/holiday-calendars/default/ensure-pl', { method: 'POST' }))).added === 0, 'powtórne ensure-pl nic nie dubluje');

// --- tydzień pon–pt z co najmniej jednym świętem w bieżącym roku, w całości wewnątrz roku ---
const Y = todayUtc().getUTCFullYear();
const isoOf = (dt) => dt.toISOString().slice(0, 10);
const swieta = polishHolidays(Y).map((h) => h.date);
const wDniuRoboczym = swieta.find((dt) => dt.getUTCDay() >= 1 && dt.getUTCDay() <= 5 && dt.getUTCMonth() > 0 && dt.getUTCMonth() < 11);
const pon = new Date(wDniuRoboczym); pon.setUTCDate(pon.getUTCDate() - (pon.getUTCDay() - 1));
const pt = new Date(pon); pt.setUTCDate(pt.getUTCDate() + 4);
const swietaWTygodniu = swieta.filter((dt) => dt >= pon && dt <= pt).length;
const oczekiwane = 5 - swietaWTygodniu;
console.log(`  (tydzień ${isoOf(pon)}–${isoOf(pt)}, świąt w tygodniu: ${swietaWTygodniu})`);

await prisma.sprint.create({ data: { name: 'Sprint SD', dateFrom: pon, dateTo: pt, squadId: squad.id } });
const sprint = await prisma.sprint.findFirst({ where: { name: 'Sprint SD' } });
const wpis = await j(await post('/absences', { employeeId: bez.id, typeId: urlop.id, dateFrom: isoOf(pon), dateTo: isoOf(pt) }));
ok((await j(await aAdmin(`/employees/${bez.id}/balance`))).used === oczekiwane, `licznik: osoba bez kalendarza liczy ${oczekiwane} dni (święto pominięte)`);
const rows = await j(await aAdmin(`/absences?employeeId=${bez.id}`));
ok(rows.find((r) => r.id === wpis.id)?.workingDays === oczekiwane, `historia: wiersz ma ${oczekiwane} dni`);
const usage = await j(await aAdmin(`/reports/usage?unitId=${squad.id}`));
ok(usage.rows.find((r) => r.employeeId === bez.id)?.used === oczekiwane, `raport: wykorzystano ${oczekiwane}`);
const cap = await j(await aAdmin(`/capacity?sprintId=${sprint.id}&unitId=${squad.id}`));
ok(cap.totalPersonDays === oczekiwane && cap.absentPersonDays === oczekiwane, `capacity: ${oczekiwane} osobodni w sprincie, wszystkie nieobecne`);

// --- własny kalendarz wygrywa z domyślnym (pusty → tylko weekendy) ---
const wlasny = await j(await post('/holiday-calendars', { name: 'Własny SD' }));
const own = await mk('sdown', 'EMPLOYEE', { holidayCalendarId: wlasny.id });
await j(await post('/absences', { employeeId: own.id, typeId: urlop.id, dateFrom: isoOf(pon), dateTo: isoOf(pt) }));
ok((await j(await aAdmin(`/employees/${own.id}/balance`))).used === 5, 'własny pusty kalendarz: 5 dni, domyślny nie nadpisuje własnego');

// Sprzątanie: kolejne suity zakładają brak świąt i brak kalendarza domyślnego (baza czyszczona raz na start).
await prisma.holiday.deleteMany({ where: { calendarId: cal.id } });
await prisma.holidayCalendar.delete({ where: { id: cal.id } });

await prisma.$disconnect();
console.log(failures === 0 ? '\nŚWIĘTA Z KALENDARZA DOMYŚLNEGO OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
