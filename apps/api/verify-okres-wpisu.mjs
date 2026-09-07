// Uwaga zleceniodawcy (feedback002): planując grudzień na koncie B2B widział „Balans po zapisie" liczony
// z salda BIEŻĄCEGO roku budżetowego i koszt NASTĘPNEGO, a po zapisie pulpit „nic nie zmieniał".
// Podgląd liczy teraz saldo okresu, do którego należy wpis, i nazywa ten okres; licznik przyjmuje
// `?year=`, żeby pulpit mógł pokazać sąsiedni okres.
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';
import { todayUtc } from '../../packages/core/dist/today.js';

await waitForApi();

const Y = todayUtc().getUTCFullYear();
const mk = (lg, role, emp) => prisma.employee.create({ data: { firstName: lg, lastName: 'OW', email: `${lg}@ow.pl`, login: lg, role, employmentType: emp, startDate: new Date(Date.UTC(Y, 0, 1)), passwordHash: hashPassword('haslo123') } });
await prisma.adminSetting.deleteMany({ where: { key: { startsWith: 'leavePool.' } } });
await prisma.adminSetting.create({ data: { key: 'leavePool.default', value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop OW' } });
const uop = await mk('owuop', 'EMPLOYEE', 'UOP');
const b2b = await mk('owb2b', 'EMPLOYEE', 'B2B');
const dyr = await mk('owdyr', 'DIRECTOR', 'UOP');
const aUop = as(await login('owuop', 'haslo123'));
const aB2b = as(await login('owb2b', 'haslo123'));
const aDyr = as(await login('owdyr', 'haslo123'));
const preview = async (a, id, from, to) => j(await a(`/absences/preview?employeeId=${id}&from=${from}&to=${to}&typeId=${urlop.id}`));

// --- UoP: 3 dni w tym roku (drugi pełny tydzień lutego: pon–śr, bez świąt), potem podgląd na przyszły rok ---
const feb = new Date(Date.UTC(Y, 1, 8)); feb.setUTCDate(feb.getUTCDate() + ((8 - feb.getUTCDay()) % 7)); // poniedziałek ≥ 8.02
const isoOf = (dt) => dt.toISOString().slice(0, 10);
const sr = new Date(feb); sr.setUTCDate(sr.getUTCDate() + 2);
await j(await aUop('/absences', { method: 'POST', body: JSON.stringify({ employeeId: uop.id, typeId: urlop.id, dateFrom: isoOf(feb), dateTo: isoOf(sr) }) }));
const teraz = await preview(aUop, uop.id, `${Y}-06-01`, `${Y}-06-01`);
ok(teraz.period?.year === Y && teraz.remaining === 23, `podgląd w bieżącym okresie: okres ${Y}, saldo 23 (26 − 3)`);
const przyszly = await preview(aUop, uop.id, `${Y + 1}-03-01`, `${Y + 1}-03-03`);
ok(przyszly.period?.year === Y + 1 && przyszly.period?.type === 'CALENDAR', `podgląd na przyszły rok nazywa okres ${Y + 1}`);
// Pula przyszłego roku (26) + zaległe z bieżącego (26 − 3 = 23, FR-B7) = 49; bieżące 3 dni nie są odejmowane drugi raz.
ok(przyszly.remaining === 49, `saldo „przed" to pula przyszłego roku z zaległymi (49), nie saldo bieżącego (jest ${przyszly.remaining})`);
ok(przyszly.remainingAfter === 49 - przyszly.workingDays, 'saldo „po" = saldo przyszłego roku minus koszt wpisu');

// --- B2B: grudzień należy do następnego roku budżetowego ---
const gru = await preview(aB2b, b2b.id, `${Y}-12-07`, `${Y}-12-07`);
ok(gru.period?.type === 'BUDGET' && gru.period?.year === Y + 1 && gru.period?.from === `${Y}-12-01`, `B2B: grudzień ${Y} to rok budżetowy ${Y + 1} (od ${gru.period?.from})`);

// --- licznik z ?year= ---
const bUop = await j(await aUop(`/employees/${uop.id}/balance?year=${Y + 1}`));
ok(bUop.period.from === `${Y + 1}-01-01` && bUop.period.year === Y + 1 && bUop.used === 0, `UoP ?year=${Y + 1}: okres od 1 stycznia, wykorzystano 0`);
const bB2b = await j(await aB2b(`/employees/${b2b.id}/balance?year=${Y + 1}`));
ok(bB2b.period.from === `${Y}-12-01` && bB2b.period.to === `${Y + 1}-11-30`, `B2B ?year=${Y + 1}: grudzień ${Y} – listopad ${Y + 1}`);
ok((await aUop(`/employees/${uop.id}/balance?year=abc`)).status === 400, '?year=abc → 400');
ok((await aUop(`/employees/${uop.id}/balance`)).ok, 'bez ?year= — okres bieżący jak dotąd');
ok((await aDyr(`/employees/${uop.id}/balance?year=${Y}`)).status === 403, 'dyrektor nadal nie czyta cudzego salda (403)');

await prisma.$disconnect();
console.log(failures === 0 ? '\nOKRES WPISU OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
