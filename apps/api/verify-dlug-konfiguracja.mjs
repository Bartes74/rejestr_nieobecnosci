// Spłata długu: reguły administratora z bazy (FR-E3/F5/J2) zamiast wartości zaszytych w kodzie
// + dni robocze liczone przez serwer z kalendarzem świąt (spójność z balansem).
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

const YEAR = new Date().getUTCFullYear();
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop DK' } });

// kalendarz z jednym świętem w środku zakresu — to ono odróżnia liczenie serwera od naiwnego
const cal = await prisma.holidayCalendar.create({ data: { name: 'Kal DK' } });
await prisma.holiday.create({ data: { calendarId: cal.id, date: new Date(Date.UTC(YEAR, 5, 3)), name: 'Święto DK' } }); // 3 czerwca

const tribe = await prisma.orgUnit.create({ data: { name: 'Tribe DK', type: 'TRIBE' } });
const squad = await prisma.orgUnit.create({ data: { name: 'Squad DK', type: 'SQUAD', parentId: tribe.id } });
const mk = (login, role, extra = {}) => prisma.employee.create({ data: { firstName: login, lastName: 'DK', email: `${login}@x.pl`, login, role, employmentType: 'UOP', startDate: new Date(Date.UTC(YEAR, 0, 1)), passwordHash: hashPassword('haslo123'), ...extra } });
await mk('dkadmin', 'ADMIN');
const anna = await mk('dkanna', 'EMPLOYEE', { holidayCalendarId: cal.id });
await prisma.orgUnitMembership.create({ data: { employeeId: anna.id, orgUnitId: squad.id } });

const aAdmin = as(await login('dkadmin', 'haslo123'));
const aAnna = as(await login('dkanna', 'haslo123'));

// ── 1. Dni robocze z serwera uwzględniają święto ──────────────────────────────
// pon 1.06 – pt 5.06 = 5 dni roboczych, ale 3.06 to święto Anny → 4
const pon = new Date(Date.UTC(YEAR, 5, 1));
const dow = pon.getUTCDay(); // wyrównanie do poniedziałku tego tygodnia
const mon = new Date(pon); mon.setUTCDate(mon.getUTCDate() + ((8 - dow) % 7 === 0 ? 0 : (8 - dow) % 7));
const isoOf = (d) => d.toISOString().slice(0, 10);
const fri = new Date(mon); fri.setUTCDate(fri.getUTCDate() + 4);
// święto ustawiamy dokładnie na środę tego tygodnia, żeby test nie zależał od kalendarza roku
const sroda = new Date(mon); sroda.setUTCDate(sroda.getUTCDate() + 2);
await prisma.holiday.deleteMany({ where: { calendarId: cal.id } });
await prisma.holiday.create({ data: { calendarId: cal.id, date: sroda, name: 'Święto DK' } });

await j(await aAnna('/absences', { method: 'POST', body: JSON.stringify({ employeeId: anna.id, typeId: urlop.id, dateFrom: isoOf(mon), dateTo: isoOf(fri) }) }));
const lista = await j(await aAnna(`/absences?employeeId=${anna.id}`));
ok(lista[0].workingDays === 4, `serwer liczy 4 dni robocze (pon–pt minus święto), a nie 5 — było ${lista[0].workingDays}`);

const bal = await j(await aAnna(`/employees/${anna.id}/balance`));
ok(bal.used === lista[0].workingDays, `liczba dni na liście = dni odjęte z balansu (${bal.used}) — koniec rozjazdu`);

// ── 2. Reguły administratora z bazy ───────────────────────────────────────────
const domyslne = await j(await aAdmin('/settings'));
const val = (k) => domyslne.find((s) => s.key === k)?.value;
ok(val('retention.months') === 24 && val('overdue.threshold') === 10 && val('reminder.minCarriedOver') === 1,
  'domyślne reguły widoczne przez /settings (retencja 24, próg 10, przypomnienie od 1)');

// próg zalegania steruje raportem
await prisma.leaveAllowance.create({ data: { employeeId: anna.id, periodYear: YEAR, baseDays: 26, carriedOver: 0 } });
await j(await aAdmin('/settings/overdue.threshold', { method: 'PUT', body: JSON.stringify({ value: 99 }) }));
const wysoki = await j(await aAdmin(`/reports/overdue?unitId=${squad.id}`));
ok(wysoki.threshold === 99 && wysoki.rows.length === 0, 'próg 99 → nikt nie zalega (raport czyta regułę z bazy)');
await j(await aAdmin('/settings/overdue.threshold', { method: 'PUT', body: JSON.stringify({ value: 1 }) }));
const niski = await j(await aAdmin(`/reports/overdue?unitId=${squad.id}`));
ok(niski.threshold === 1 && niski.rows.length > 0, 'próg 1 → Anna zalega (zmiana reguły działa bez restartu)');

// Reguła przypomnień steruje wysyłką. Endpoint działa globalnie (cała baza), więc Anna dostaje
// wyróżniającą wartość zaległych — inaczej wynik zależałby od danych innych suit.
await prisma.leaveAllowance.update({ where: { employeeId_periodYear: { employeeId: anna.id, periodYear: YEAR } }, data: { carriedOver: 500 } });
await j(await aAdmin('/settings/reminder.minCarriedOver', { method: 'PUT', body: JSON.stringify({ value: 600 }) }));
const rzadko = await j(await aAdmin('/notifications/overdue-reminders', { method: 'POST' }));
ok(rzadko.sent === 0 && rzadko.minCarriedOver === 600, 'próg 600 dni → nikt nie dostaje przypomnienia (Anna ma 500)');
await j(await aAdmin('/settings/reminder.minCarriedOver', { method: 'PUT', body: JSON.stringify({ value: 400 }) }));
const czesto = await j(await aAdmin('/notifications/overdue-reminders', { method: 'POST' }));
ok(czesto.sent === 1, 'próg 400 dni → przypomnienie tylko do Anny (zmiana reguły działa bez restartu)');

// ── 3. Walidacja i uprawnienia ────────────────────────────────────────────────
ok((await aAdmin('/settings/nieistniejacy.klucz', { method: 'PUT', body: JSON.stringify({ value: 1 }) })).status === 400, 'nieznany klucz → 400 (biała lista)');
ok((await aAdmin('/settings/retention.months', { method: 'PUT', body: JSON.stringify({ value: -5 }) })).status === 400, 'wartość ujemna → 400');
ok((await aAdmin('/settings/retention.months', { method: 'PUT', body: JSON.stringify({ value: 'abc' }) })).status === 400, 'wartość nieliczbowa → 400');
ok((await aAnna('/settings')).status === 403, 'pracownik nie czyta reguł → 403');
ok((await aAnna('/settings/retention.months', { method: 'PUT', body: JSON.stringify({ value: 1 }) })).status === 403, 'pracownik nie zmienia reguł → 403');

await prisma.$disconnect();
console.log(failures === 0 ? '\nSPŁATA DŁUGU (reguły + dni robocze) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
