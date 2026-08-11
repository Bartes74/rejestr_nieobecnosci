// Faza 2 / FR-A3: niepełne dni (AM/PM/godziny) liczone jako ułamek w balansie + walidacja pojedynczej daty.
import { API, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

const as = (t) => (p, b) => fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify(b) });

await waitForApi();

const anna = await prisma.employee.create({ data: { firstName: 'F2', lastName: 'Anna', email: 'f2anna@x.pl', login: 'f2anna', role: 'EMPLOYEE', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop F2' } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const a = as(await login('f2anna', 'haslo123'));
const tok = await login('f2anna', 'haslo123');
const aGet = (p) => fetch(API + p, { headers: { authorization: `Bearer ${tok}` } });

// pół dnia (AM) na pojedynczej dacie
await j(await a('/absences', { employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-06-08', dateTo: '2026-06-08', dayPart: 'AM' }));
let bal = await j(await aGet(`/employees/${anna.id}/balance`));
ok(bal.used === 0.5, 'AM = 0.5 dnia w wykorzystaniu');
ok(bal.remaining === 25.5, 'pozostało 25.5 (26 − 0.5)');

// godziny 09:00–13:00 = 0.5 dnia (inny dzień)
await j(await a('/absences', { employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-06-09', dateTo: '2026-06-09', dayPart: 'HOURS', hourFrom: '09:00', hourTo: '13:00' }));
bal = await j(await aGet(`/employees/${anna.id}/balance`));
ok(bal.used === 1, 'AM + 4h = łącznie 1 dzień');

// niepełny dzień na zakresie > 1 dnia → 400
ok((await a('/absences', { employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-06-15', dateTo: '2026-06-16', dayPart: 'AM' })).status === 400, 'AM na zakresie dat → 400');

await prisma.$disconnect();
console.log(failures === 0 ? '\nNIEPEŁNE DNI OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
