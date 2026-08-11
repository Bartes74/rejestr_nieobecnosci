// Faza 2: FR-I1 — pełna historia zmian wpisu (dodanie/edycja/usunięcie) w niezmiennym dzienniku, per wpis.
import { API, as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop I1' } });
const admin = await prisma.employee.create({ data: { firstName: 'Adm', lastName: 'I1', email: 'i1admin@x.pl', login: 'i1admin', role: 'ADMIN', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const anna = await prisma.employee.create({ data: { firstName: 'Anna', lastName: 'I1', email: 'i1anna@x.pl', login: 'i1anna', role: 'EMPLOYEE', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });

const aAnna = as(await login('i1anna', 'haslo123'));
const aAdmin = as(await login('i1admin', 'haslo123'));

// dodanie → edycja → usunięcie
const abs = await j(await aAnna('/absences', { method: 'POST', body: JSON.stringify({ employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-06-08', dateTo: '2026-06-08' }) }));
await j(await aAnna(`/absences/${abs.id}`, { method: 'PATCH', body: JSON.stringify({ dateTo: '2026-06-09' }) }));
await j(await aAnna(`/absences/${abs.id}`, { method: 'DELETE' }));

// historia per wpis (admin filtruje audyt po entityId)
const hist = await j(await aAdmin(`/audit?entity=Absence&entityId=${abs.id}`));
const actions = hist.map((h) => h.action);
ok(actions.includes('ABSENCE_CREATE'), 'historia: dodanie zapisane');
ok(actions.includes('ABSENCE_UPDATE'), 'historia: edycja zapisana');
ok(actions.includes('ABSENCE_DELETE'), 'historia: usunięcie zapisane');
ok(hist.every((h) => h.userId === anna.id && h.timestamp), 'każdy wpis ma użytkownika i znacznik czasu');
ok(hist.length === 3, 'pełna historia 3 operacji per wpis');

// Sam identyfikator nie mówi administratorowi nic — dziennik ma odpowiadać „kto" i „kogo dotyczy".
ok(hist.every((h) => h.userName === 'Anna I1'), 'sprawca rozwinięty w imię i nazwisko');

// Wpis w cudzym imieniu: sprawcą jest ten, kto go zrobił, a osobę, której dotyczy, rozwija odczyt
// z `subjectId` — również po usunięciu samej nieobecności, bo osoba nie wisi na jej rekordzie.
ok(hist.every((h) => h.subjectName === 'Anna I1'), 'usunięta nieobecność nadal wskazuje, kogo dotyczyła');
const cudzy = await j(await aAdmin('/absences', { method: 'POST', body: JSON.stringify({ employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-06-15', dateTo: '2026-06-15' }) }));
const wImieniu = await j(await aAdmin(`/audit?entity=Absence&entityId=${cudzy.id}`));
ok(wImieniu.every((h) => h.userName === 'Adm I1'), 'sprawcą wpisu w cudzym imieniu jest ten, kto go zrobił');
ok(wImieniu.every((h) => h.subjectName === 'Anna I1'), 'wpis o nieobecności wskazuje jej właściciela');
ok(wImieniu.every((h) => !/Anna/.test(h.description)), 'dziennik nie zamraża nazwisk w opisie (anonimizacja ma je czyścić)');

// Nazwisko idzie z tabeli pracowników, więc żądanie usunięcia danych czyści też dziennik.
await j(await aAdmin(`/employees/${anna.id}/anonymize`, { method: 'POST' }));
const poAnonimizacji = await j(await aAdmin(`/audit?entity=Absence&entityId=${abs.id}`));
ok(poAnonimizacji.every((h) => h.userName === 'Pracownik zanonimizowany'), 'anonimizacja czyści nazwisko także w dzienniku');

// Zdarzenie bez sprawcy nie może się rozwinąć w cudze nazwisko.
await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: 'i1-nie-ma-takiego', password: 'zle' }) });
const nieudane = (await j(await aAdmin('/audit?entity=Auth&action=LOGIN_FAILED&limit=1')))[0];
ok(nieudane?.userId === null && nieudane?.userName === null, 'nieudane logowanie na nieistniejący login zostaje bez sprawcy');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 2 (historia zmian) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
