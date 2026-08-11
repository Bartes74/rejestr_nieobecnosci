// FR-E3 (regresja): przypomnienie o zaległym urlopie dla urlopu WYLICZONEGO, nie tylko wpisanego ręcznie.
//
// Filtrem była kolumna LeaveAllowance.carriedOver, a `null` w tej kolumnie znaczy „wylicz
// z łańcucha poprzednich okresów" i jest przypadkiem DOMYŚLNYM (patrz schema.prisma i
// PoolsController.setAllowance). W SQL `NULL >= 1` daje `NULL`, więc taki wiersz nie pasował
// do warunku — a osoby, którym administrator nigdy nie wpisywał korekty ręcznie, w ogóle
// nie mają wiersza LeaveAllowance. Przypomnienia szły więc do garstki, zadanie nocne
// raportowało „wysłane: 0" i wyglądało na działające.
//
// Suita celowo NIE tworzy żadnego wiersza LeaveAllowance: sprawdza dokładnie ten przypadek,
// w którym zaległe dni istnieją, ale wyłącznie jako wynik obliczenia.
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

const rok = new Date().getUTCFullYear();
const mk = (login, role, extra = {}) => prisma.employee.create({ data: { firstName: login, lastName: 'PZ', email: `${login}@x.pl`, login, role, employmentType: 'UOP', startDate: new Date(`${rok}-01-01`), passwordHash: hashPassword('haslo123'), ...extra } });

await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const admin = await mk('pzadmin', 'ADMIN');
// Zatrudniony rok wcześniej i bez ani jednej nieobecności — cała pula poprzedniego okresu
// przechodzi dalej. Zaległe dni są tu WYNIKIEM OBLICZENIA: nie ma wiersza LeaveAllowance.
const zalega = await mk('pzzalega', 'EMPLOYEE', { startDate: new Date(`${rok - 1}-01-01`) });
// Zatrudniony w bieżącym okresie — nie ma z czego rolować, więc nie powinien dostać listu.
const swiezy = await mk('pzswiezy', 'EMPLOYEE');

const aAdmin = as(await login('pzadmin', 'haslo123'));
// Runner czyści bazę raz, na starcie, więc suita dziedziczy ustawienia po poprzednich
// (verify-dlug-konfiguracja zostawia próg na 400 dni). Warunki testu ustawiamy więc wprost,
// zamiast liczyć na wartości domyślne.
await j(await aAdmin('/settings/reminder.minCarriedOver', { method: 'PUT', body: JSON.stringify({ value: 1 }) }));

// Warunek testu sprawdzany na WŁASNYCH osobach — inne suity zdążyły już założyć swoje korekty.
const moje = [zalega.id, swiezy.id, admin.id];
ok((await prisma.leaveAllowance.count({ where: { employeeId: { in: moje } } })) === 0, 'warunek testu: osoby tej suity nie mają ręcznej korekty w LeaveAllowance');
const bal = await j(await aAdmin(`/employees/${zalega.id}/balance`));
ok(bal.carriedOver >= 1, `licznik widzi zaległy urlop (${bal.carriedOver} dni) mimo braku wiersza w bazie`);

// --- WYSYŁKA --------------------------------------------------------------------------------
const wynik = await j(await aAdmin('/notifications/overdue-reminders', { method: 'POST' }));
ok(wynik.sent >= 1, `wysłano przypomnienia (${wynik.sent}) — reguła obejmuje urlop wyliczony`);

const listy = await prisma.auditLog.findMany({ where: { entity: 'Email', action: 'EMAIL_SENT' } });
ok(listy.some((l) => l.subjectId === zalega.id), 'osoba z wyliczonym zaległym urlopem dostała list');
ok(!listy.some((l) => l.subjectId === swiezy.id), 'osoba bez zaległych dni listu nie dostała');

// --- WYKLUCZENIA ----------------------------------------------------------------------------
// Byłemu pracownikowi nie ma po co przypominać o planowaniu urlopu, a konto zanonimizowane
// ma adres @example.invalid, więc list i tak by odbił.
const byly = await mk('pzbyly', 'EMPLOYEE', { startDate: new Date(`${rok - 1}-01-01`), endDate: new Date(`${rok}-01-31`) });
const doAnon = await mk('pzanon', 'EMPLOYEE', { startDate: new Date(`${rok - 1}-01-01`) });
await j(await aAdmin(`/employees/${doAnon.id}/anonymize`, { method: 'POST' }));

await prisma.auditLog.deleteMany({ where: { entity: 'Email' } });
await j(await aAdmin('/notifications/overdue-reminders', { method: 'POST' }));
const drugaTura = await prisma.auditLog.findMany({ where: { entity: 'Email', action: 'EMAIL_SENT' } });
ok(!drugaTura.some((l) => l.subjectId === byly.id), 'były pracownik pominięty');
ok(!drugaTura.some((l) => l.subjectId === doAnon.id), 'konto zanonimizowane pominięte');
ok(drugaTura.some((l) => l.subjectId === zalega.id), 'wykluczenia nie zabrały listu osobie, która ma go dostać');

// --- PRÓG Z KONFIGURACJI --------------------------------------------------------------------
await j(await aAdmin('/settings/reminder.minCarriedOver', { method: 'PUT', body: JSON.stringify({ value: 999 }) }));
await prisma.auditLog.deleteMany({ where: { entity: 'Email' } });
const poProgu = await j(await aAdmin('/notifications/overdue-reminders', { method: 'POST' }));
ok(poProgu.sent === 0, 'próg z konfiguracji administratora nadal obowiązuje (999 dni → nikt)');

// Wartość domyślna z powrotem — kolejne suity dzielą tę samą bazę.
await j(await aAdmin('/settings/reminder.minCarriedOver', { method: 'PUT', body: JSON.stringify({ value: 1 }) }));

await prisma.$disconnect();
console.log(failures === 0 ? '\nPRZYPOMNIENIA O ZALEGŁYM URLOPIE OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
