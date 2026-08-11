// FR-B7 — rolowanie urlopu zaległego na przełomie okresu rozliczeniowego.
// Bez tego 1 stycznia (UoP) i 1 grudnia (B2B/OUT) saldo zaległych spadało do zera, bo dla nowego
// okresu nie istniał jeszcze żaden wiersz LeaveAllowance. Suita sprawdza łańcuch okresów, ręczną
// korektę administratora oraz zgodność licznika z raportem.
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

// Okresy liczone względem DZIŚ, nie względem stałych dat: suita ma przechodzić w każdym roku,
// a nie tylko w tym, w którym powstała.
const now = new Date();
const Y = now.getUTCFullYear();
const uopPrev = Y - 1;                                     // poprzedni rok kalendarzowy (UoP)
// Rok budżetowy B2B: grudzień należy już do kolejnego. Bieżący okres to (Y lub Y+1), poprzedni o 1 mniej.
const b2bNow = now.getUTCMonth() === 11 ? Y + 1 : Y;
const b2bPrev = b2bNow - 1;                                // okres gru(b2bPrev−1) – lis(b2bPrev)

await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
await prisma.adminSetting.deleteMany({ where: { key: { in: ['leavePool.UOP', 'leavePool.B2B', 'leavePool.OUT'] } } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop B7' } });

const squad = await prisma.orgUnit.create({ data: { name: 'Squad B7', type: 'SQUAD' } });
const mk = async (login, role, employmentType, startDate) => {
  const e = await prisma.employee.create({ data: { firstName: login, lastName: 'B7', email: `${login}@x.pl`, login, role, employmentType, startDate: new Date(startDate), passwordHash: hashPassword('haslo123') } });
  await prisma.orgUnitMembership.create({ data: { employeeId: e.id, orgUnitId: squad.id } });
  return e;
};

const admin = await mk('b7admin', 'ADMIN', 'UOP', `${Y}-01-01`);
const ala = await mk('b7ala', 'EMPLOYEE', 'UOP', `${uopPrev}-01-01`);       // jeden pełny okres wstecz
const bogdan = await mk('b7bogdan', 'EMPLOYEE', 'UOP', `${Y - 2}-01-01`);   // dwa okresy wstecz
const cela = await mk('b7cela', 'EMPLOYEE', 'B2B', `${b2bPrev - 1}-12-01`); // rok budżetowy
const dawid = await mk('b7dawid', 'EMPLOYEE', 'UOP', `${Y}-01-01`);         // zatrudniony w bieżącym okresie

const aAdmin = as(await login('b7admin', 'haslo123'));
const bal = async (id) => j(await aAdmin(`/employees/${id}/balance`));

// Nieobecności zapisujemy wprost w bazie: to dane historyczne z zamkniętych okresów,
// a przedmiotem testu jest wyliczenie, nie ścieżka zapisu (tę pokrywa verify-krok2).
const absence = (employeeId, from, to) => prisma.absence.create({ data: { employeeId, typeId: urlop.id, dateFrom: new Date(from), dateTo: new Date(to) } });

// --- 1. jeden okres wstecz: pula minus wykorzystanie przechodzi na bieżący okres ---
await absence(ala.id, `${uopPrev}-06-01`, `${uopPrev}-06-30`); // czerwiec: ~21 dni roboczych
const uzyte = (await j(await aAdmin(`/absences?employeeId=${ala.id}`))).reduce((s, a) => s + a.workingDays, 0);
ok(uzyte > 0, `wykorzystanie w okresie ${uopPrev} policzone: ${uzyte} dni roboczych`);
let b = await bal(ala.id);
ok(b.period.year === Y, `okres bieżący to ${Y} (UoP = rok kalendarzowy)`);
ok(b.carriedOver === 26 - uzyte, `zaległe wyliczone automatycznie: 26 − ${uzyte} = ${26 - uzyte} (jest ${b.carriedOver})`);
ok(b.remaining === 26 + b.carriedOver, 'pozostało = pula bieżąca + zaległe');

// --- 2. dwa okresy wstecz: zaległe kumulują się przez łańcuch ---
b = await bal(bogdan.id);
ok(b.carriedOver === 52, `dwa nietknięte okresy → 52 dni zaległe (jest ${b.carriedOver})`);

// --- 3. zatrudniony w bieżącym okresie: nie ma z czego rolować ---
b = await bal(dawid.id);
ok(b.carriedOver === 0, 'brak wcześniejszych okresów → zero zaległych, nie „coś z niczego"');

// --- 4. rok budżetowy (B2B) roluje tak samo jak kalendarzowy ---
await absence(cela.id, `${b2bPrev}-06-01`, `${b2bPrev}-06-30`);
const celaUzyte = (await j(await aAdmin(`/absences?employeeId=${cela.id}`))).reduce((s, a) => s + a.workingDays, 0);
b = await bal(cela.id);
ok(b.period.type === 'BUDGET' && b.period.year === b2bNow, `B2B: okres budżetowy ${b2bNow}`);
ok(b.carriedOver === 26 - celaUzyte, `B2B: zaległe z okresu ${b2bPrev} = ${26 - celaUzyte} (jest ${b.carriedOver})`);

// --- 5. ręczna korekta administratora wygrywa nad wyliczeniem ---
await j(await aAdmin('/pools/allowance', { method: 'PUT', body: JSON.stringify({ employeeId: ala.id, periodYear: Y, baseDays: 26, carriedOver: 3 }) }));
b = await bal(ala.id);
ok(b.carriedOver === 3, 'korekta administratora nadpisuje wyliczone zaległe');

// --- 6. korekta „0" to decyzja, nie brak decyzji ---
await j(await aAdmin('/pools/allowance', { method: 'PUT', body: JSON.stringify({ employeeId: ala.id, periodYear: Y, baseDays: 26, carriedOver: 0 }) }));
b = await bal(ala.id);
ok(b.carriedOver === 0, 'jawne zero zostaje zerem (a nie wraca do wyliczenia)');

// --- 7. wyczyszczenie korekty przywraca liczenie automatyczne ---
await j(await aAdmin('/pools/allowance', { method: 'PUT', body: JSON.stringify({ employeeId: ala.id, periodYear: Y, baseDays: 26 }) }));
b = await bal(ala.id);
ok(b.carriedOver === 26 - uzyte, 'brak wartości w korekcie → znów liczone automatycznie');

// --- 8. raport pokazuje to samo co licznik (jedna implementacja, nie dwie) ---
const usage = await j(await aAdmin(`/reports/usage?unitId=${squad.id}`));
const rowOf = (id) => usage.rows.find((r) => r.employeeId === id);
ok(rowOf(ala.id).carriedOver === b.carriedOver, 'raport i licznik zgadzają się co do zaległych (Ala)');
ok(rowOf(bogdan.id).carriedOver === 52, 'raport roluje łańcuch tak samo jak licznik (Bogdan)');
ok(rowOf(dawid.id).carriedOver === 0, 'raport: brak historii → zero zaległych (Dawid)');

// --- 9. zaległe powiększają dostępną pulę przy zapisie (FR-A7 nie blokuje ponad pulą bieżącą) ---
const aBogdan = as(await login('b7bogdan', 'haslo123'));
const res = await aBogdan('/absences', { method: 'POST', body: JSON.stringify({ employeeId: bogdan.id, typeId: urlop.id, dateFrom: `${Y}-03-02`, dateTo: `${Y}-05-29` }) });
ok(res.ok, 'wpis dłuższy niż pula bieżąca przechodzi dzięki zaległym (nie fałszywe przekroczenie)');

console.log(failures ? `\n❌ FR-B7: ${failures} niepowodzeń` : '\n✅ FR-B7: rolowanie urlopu zaległego OK');
await prisma.$disconnect();
process.exit(failures ? 1 : 0);
