// B4 — powiadomienia in-app: wyliczany feed z istniejących sygnałów (zaległy urlop, nadchodzące nieobecności).
// Guard RODO: feed nigdy nie ujawnia typu nieobecności (nawet L4) — tylko daty/liczby.
import { API, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const l4 = await prisma.absenceType.create({ data: { name: 'L4 FEED SEKRET', affectsPool: false, specialCategory: true } });
const anna = await prisma.employee.create({ data: { firstName: 'Anna', lastName: 'FEED', email: 'feedanna@x.pl', login: 'feedanna', role: 'EMPLOYEE', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const year = new Date().getUTCFullYear();
await prisma.leaveAllowance.create({ data: { employeeId: anna.id, periodYear: year, baseDays: 26, carriedOver: 4 } }); // zaległy urlop
// nadchodząca nieobecność (≤7 dni od dziś) — typ L4, by sprawdzić że feed go NIE ujawnia
const soon = new Date(); soon.setUTCHours(0, 0, 0, 0); soon.setUTCDate(soon.getUTCDate() + 2);
await prisma.absence.create({ data: { employeeId: anna.id, typeId: l4.id, dateFrom: soon, dateTo: soon } });

const tok = await login('feedanna', 'haslo123');
const feed = await j(await fetch(`${API}/notifications/feed`, { headers: { authorization: `Bearer ${tok}` } }));

ok(feed.count >= 2 && feed.items.length === feed.count, `feed ma ≥2 pozycje (count=${feed.count})`);
ok(feed.items.some((it) => it.kind === 'overdue' && /4 dni zaległego/.test(it.text)), 'pozycja: zaległy urlop (4 dni)');
ok(feed.items.some((it) => it.kind === 'upcoming' && /Zbliża się/.test(it.text)), 'pozycja: nadchodząca nieobecność');
ok(!JSON.stringify(feed).includes('L4 FEED SEKRET') && !JSON.stringify(feed).includes('specialCategory'), 'guard RODO: feed NIE ujawnia typu nieobecności (nawet L4)');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 3 (powiadomienia in-app) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
