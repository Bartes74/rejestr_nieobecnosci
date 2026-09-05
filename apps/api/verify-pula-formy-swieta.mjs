// Pula nieobecności per forma zatrudnienia (FR-B3/G2) + automatyczny import świąt PL (FR-G3).
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

// Suita sprawdza dziedziczenie puli wspólnej, więc startuje bez ustawień per forma.
await prisma.adminSetting.deleteMany({ where: { key: { startsWith: 'leavePool.' } } });

const mk = (login, role, employmentType) => prisma.employee.create({ data: { firstName: login, lastName: 'PF', email: `${login}@x.pl`, login, role, employmentType, startDate: new Date('2020-01-01'), passwordHash: hashPassword('haslo123') } });
const admin = await mk('pfadmin', 'ADMIN', 'UOP');
const uop = await mk('pfuop', 'EMPLOYEE', 'UOP');
const b2b = await mk('pfb2b', 'EMPLOYEE', 'B2B');
const out = await mk('pfout', 'EMPLOYEE', 'OUT');

const aAdmin = as(await login('pfadmin', 'haslo123'));
const bal = async (e) => (await j(await aAdmin(`/employees/${e.id}/balance`))).pool;

// wspólna pula obowiązuje wszystkie formy, dopóki nie ustawiono własnej
await j(await aAdmin('/pools/default', { method: 'PUT', body: JSON.stringify({ value: 26 }) }));
ok((await bal(uop)) === 26 && (await bal(b2b)) === 26 && (await bal(out)) === 26, 'pula wspólna 26 dla wszystkich form');

// własna pula dla B2B i OUT nie rusza UoP
await j(await aAdmin('/pools/default', { method: 'PUT', body: JSON.stringify({ value: 20, employmentType: 'B2B' }) }));
await j(await aAdmin('/pools/default', { method: 'PUT', body: JSON.stringify({ value: 22, employmentType: 'OUT' }) }));
ok((await bal(uop)) === 26, 'UoP dziedziczy pulę wspólną (26)');
ok((await bal(b2b)) === 20, 'B2B ma własną pulę (20)');
ok((await bal(out)) === 22, 'OUT ma własną pulę (22)');

const defaults = await j(await aAdmin('/pools/default'));
ok(defaults.value === 26 && defaults.byType.B2B === 20 && defaults.byType.UOP === null, 'GET /pools/default: wspólna + surowe wartości form');

// minimum 20 dni dla B2B i OUT (reguła zamawiającego) — sprawdzane na puli efektywnej, także dziedziczonej
const put = (body) => aAdmin('/pools/default', { method: 'PUT', body: JSON.stringify(body) });
ok((await put({ value: 19, employmentType: 'B2B' })).status === 400, 'B2B 19 → 400 (minimum 20)');
ok((await put({ value: 10 })).ok, 'wspólna 10 przechodzi, gdy B2B i OUT mają własne pule ≥ 20');
await prisma.adminSetting.delete({ where: { key: 'leavePool.OUT' } });
ok((await put({ value: 10 })).status === 400, 'wspólna 10 → 400, gdy OUT dziedziczy wspólną');
ok((await put({ value: -1 })).status === 400, 'pula ujemna → 400');
await j(await put({ value: 22, employmentType: 'OUT' }));
await j(await put({ value: 26 }));
ok((await bal(uop)) === 26 && (await bal(out)) === 22, 'po próbach stan wraca: UoP 26, OUT 22');
ok((await aAdmin('/pools/allowance', { method: 'PUT', body: JSON.stringify({ employeeId: b2b.id, periodYear: new Date().getUTCFullYear(), baseDays: 20, overrideDays: 12 }) })).status === 400, 'korekta B2B poniżej 20 → 400');
ok((await aAdmin('/pools/allowance', { method: 'PUT', body: JSON.stringify({ employeeId: admin.id, periodYear: new Date().getUTCFullYear(), baseDays: 12 }) })).ok, 'korekta UoP 12 przechodzi — UoP nie ma minimum');

// korekta indywidualna ma priorytet nad pulą formy (FR-B6)
await j(await aAdmin('/pools/allowance', { method: 'PUT', body: JSON.stringify({ employeeId: b2b.id, periodYear: new Date().getUTCFullYear(), baseDays: 20, overrideDays: 31 }) }));
ok((await bal(b2b)) === 31, 'korekta indywidualna bije pulę formy (31)');

// raport używa puli właściwej dla formy, nie jednej dla wszystkich
const tribe = await prisma.orgUnit.create({ data: { name: 'Tribe PF', type: 'TRIBE' } });
for (const e of [uop, out]) await prisma.orgUnitMembership.create({ data: { employeeId: e.id, orgUnitId: tribe.id } });
const usage = await j(await aAdmin(`/reports/usage?unitId=${tribe.id}`));
const poolOf = (id) => usage.rows.find((r) => r.employeeId === id)?.pool;
ok(poolOf(uop.id) === 26 && poolOf(out.id) === 22, 'raport wykorzystania liczy pulę per forma (26 / 22)');

// FR-G3 — import świąt ustawowych, liczonych lokalnie
const cal = await j(await aAdmin('/holiday-calendars', { method: 'POST', body: JSON.stringify({ name: 'Polska PF' }) }));
const imp = await j(await aAdmin(`/holiday-calendars/${cal.id}/import-pl?year=2026`, { method: 'POST' }));
ok(imp.added === 14, `import 2026 dodał komplet 14 świąt ustawowych (${imp.added})`);
const hols = await j(await aAdmin(`/holidays?calendarId=${cal.id}`));
const dni = hols.map((h) => h.date.slice(0, 10));
ok(dni.includes('2026-04-06') && dni.includes('2026-06-04'), 'święta ruchome: Poniedziałek Wielkanocny i Boże Ciało');
ok(dni.includes('2026-12-24') && dni.includes('2026-11-11'), 'święta stałe: Wigilia i 11 listopada');
const again = await j(await aAdmin(`/holiday-calendars/${cal.id}/import-pl?year=2026`, { method: 'POST' }));
ok(again.added === 0, 'powtórny import nie duplikuje dni');

// import świąt to operacja administratora
const aUop = as(await login('pfuop', 'haslo123'));
ok((await aUop(`/holiday-calendars/${cal.id}/import-pl?year=2027`, { method: 'POST' })).status === 403, 'pracownik nie zaimportuje świąt (403)');

// święta z kalendarza pracownika nie są naliczane
await prisma.employee.update({ where: { id: uop.id }, data: { holidayCalendarId: cal.id } });
const typ = await prisma.absenceType.create({ data: { name: 'Urlop PF' } });
await j(await aAdmin('/absences', { method: 'POST', body: JSON.stringify({ employeeId: uop.id, typeId: typ.id, dateFrom: '2026-04-03', dateTo: '2026-04-07' }) }));
const balUop = await j(await aAdmin(`/employees/${uop.id}/balance`));
ok(balUop.used === 2, `pt 3.04 + wt 7.04 = 2 dni (poniedziałek wielkanocny pominięty), jest ${balUop.used}`);

await prisma.$disconnect();
console.log(failures === 0 ? '\nPULA PER FORMA + ŚWIĘTA PL OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
