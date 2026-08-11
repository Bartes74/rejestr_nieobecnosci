// Faza 2: FR-B8 — zmiana formy zatrudnienia w trakcie roku (właściwy okres + zachowana historia).
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

const mk = (login, role, emp) => prisma.employee.create({ data: { firstName: login, lastName: 'B8', email: `${login}@x.pl`, login, role, employmentType: emp, startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop B8' } });
const admin = await mk('b8admin', 'ADMIN', 'UOP');
const anna = await mk('b8anna', 'EMPLOYEE', 'B2B'); // start: B2B

const aAdmin = as(await login('b8admin', 'haslo123'));
const aAnna = as(await login('b8anna', 'haslo123'));

// przed zmianą: B2B → okres budżetowy
let bal = await j(await aAnna(`/employees/${anna.id}/balance`));
ok(bal.period.type === 'BUDGET', 'przed: forma B2B → okres budżetowy');

// historia: wpis sprzed zmiany
await j(await aAnna('/absences', { method: 'POST', body: JSON.stringify({ employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-06-10', dateTo: '2026-06-10' }) }));

// pracownik nie zmienia formy
ok((await aAnna(`/employees/${anna.id}/employment-type`, { method: 'PATCH', body: JSON.stringify({ employmentType: 'UOP' }) })).status === 403, 'pracownik nie zmienia formy → 403');

// admin zmienia B2B → UoP
const upd = await j(await aAdmin(`/employees/${anna.id}/employment-type`, { method: 'PATCH', body: JSON.stringify({ employmentType: 'UOP' }) }));
ok(upd.employmentType === 'UOP', 'admin zmienił formę na UoP');

// po zmianie: UoP → okres kalendarzowy (nowe reguły)
bal = await j(await aAnna(`/employees/${anna.id}/balance`));
ok(bal.period.type === 'CALENDAR', 'po: forma UoP → okres kalendarzowy');

// historia zachowana
const list = await j(await aAnna(`/absences?employeeId=${anna.id}`));
ok(list.length === 1, 'historia sprzed zmiany zachowana (1 wpis)');
ok(!!(await prisma.auditLog.findFirst({ where: { action: 'EMPLOYMENT_TYPE_CHANGE', entityId: anna.id } })), 'zmiana formy odnotowana w audycie');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 2 (zmiana formy) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
