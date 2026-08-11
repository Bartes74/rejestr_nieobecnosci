// FR-H4 / NFR-5 (regresja bezpieczeństwa): odebranie uprawnień musi działać od razu.
//
// Token niósł rolę i uprawnienia w środku i żył dwanaście godzin. Odebranie uprawnienia
// rozszerzonego, degradacja roli i zakończenie współpracy nie odbierały więc dostępu —
// odbierały go dopiero po wygaśnięciu tokenu. Administrator, który reagował na incydent,
// nie miał czym zareagować: w interfejsie uprawnienie znikało, w API działało dalej.
//
// Suita sprawdza to jedynym sensownym sposobem: TYM SAMYM tokenem, wydanym przed zmianą.
import { API, as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

const mk = (login, role, extra = {}) => prisma.employee.create({ data: { firstName: login, lastName: 'SU', email: `${login}@x.pl`, login, role, employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123'), ...extra } });
const admin = await mk('suadmin', 'ADMIN');
const mod = await mk('sumod', 'EMPLOYEE');
const cel = await mk('sucel', 'EMPLOYEE');
const degradowany = await mk('sudegr', 'ADMIN');
const konczacy = await mk('sukoniec', 'EMPLOYEE');
const znikajacy = await mk('suznika', 'EMPLOYEE');
const anonimizowany = await mk('suanon', 'EMPLOYEE');
const resetowany = await mk('suhaslo', 'EMPLOYEE');
const postronny = await mk('supostronny', 'EMPLOYEE');
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop SU' } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
await prisma.permission.create({ data: { employeeId: mod.id, scope: 'MODIFY_ABSENCE' } });

const aAdmin = as(await login('suadmin', 'haslo123'));

// --- ODEBRANIE UPRAWNIENIA ROZSZERZONEGO ----------------------------------------------------
// Token wydany, gdy uprawnienie jeszcze było — i to nim posługujemy się przez cały test.
const tokMod = await login('sumod', 'haslo123');
const aMod = as(tokMod);
const wpis = (d) => ({ employeeId: cel.id, typeId: urlop.id, dateFrom: d, dateTo: d });
ok((await aMod('/absences', { method: 'POST', body: JSON.stringify(wpis('2026-06-08')) })).status === 201, 'z MODIFY_ABSENCE: wpis w imieniu innej osoby przechodzi');

await j(await aAdmin(`/employees/${mod.id}/permissions/MODIFY_ABSENCE`, { method: 'DELETE' }));
ok((await aMod('/absences', { method: 'POST', body: JSON.stringify(wpis('2026-06-09')) })).status === 403, 'po odebraniu uprawnienia TEN SAM token dostaje 403 (bez czekania na wygaśnięcie)');

// --- DEGRADACJA ROLI ------------------------------------------------------------------------
const tokDegr = await login('sudegr', 'haslo123');
const aDegr = as(tokDegr);
ok((await aDegr('/audit')).status === 200, 'administrator czyta dziennik audytu');
await j(await aAdmin(`/employees/${degradowany.id}/role`, { method: 'PATCH', body: JSON.stringify({ role: 'EMPLOYEE' }) }));
ok((await aDegr('/audit')).status === 403, 'po degradacji roli TEN SAM token traci dostęp do dziennika');

// --- ZAKOŃCZENIE WSPÓŁPRACY -----------------------------------------------------------------
const tokKoniec = await login('sukoniec', 'haslo123');
ok((await as(tokKoniec)('/auth/me')).status === 200, 'przed zakończeniem współpracy token działa');
await prisma.employee.update({ where: { id: konczacy.id }, data: { endDate: new Date('2026-01-31') } });
ok((await as(tokKoniec)('/auth/me')).status === 401, 'po dacie zakończenia współpracy TEN SAM token przestaje działać');

// Logowanie odmawia od razu, zamiast wydawać poświadczenie, o którym z góry wiadomo, że jest martwe.
const proba = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: 'sukoniec', password: 'haslo123' }) });
ok(proba.status === 401, 'były pracownik nie zaloguje się poprawnym hasłem');

// --- USUNIĘTE KONTO -------------------------------------------------------------------------
const tokZnika = await login('suznika', 'haslo123');
ok((await as(tokZnika)('/auth/me')).status === 200, 'przed usunięciem konta token działa');
await prisma.employee.delete({ where: { id: znikajacy.id } });
ok((await as(tokZnika)('/auth/me')).status === 401, 'po usunięciu konta token przestaje działać');

// --- ANONIMIZACJA (FR-J2) -------------------------------------------------------------------
// Wiersz pracownika po anonimizacji ZOSTAJE, bo wiszą na nim wpisy nieobecności — więc strażnik
// go znajduje i bez znacznika sesji wpuszczałby dalej. Zalogować się ponownie nie sposób (brak
// hasła), ale token wydany wcześniej działał do wygaśnięcia: pół doby czytania danych po
// realizacji prawa do bycia zapomnianym.
const tokAnon = await login('suanon', 'haslo123');
const tokPostronny = await login('supostronny', 'haslo123');
ok((await as(tokAnon)('/auth/me')).status === 200, 'przed anonimizacją token działa');

await j(await aAdmin(`/employees/${anonimizowany.id}/anonymize`, { method: 'POST' }));
ok((await as(tokAnon)('/auth/me')).status === 401, 'po anonimizacji TEN SAM token przestaje działać');
ok((await as(tokPostronny)('/auth/me')).status === 200, 'anonimizacja jednej osoby nie rusza sesji innej');

// --- RESET HASŁA PRZEZ ADMINISTRATORA -------------------------------------------------------
// Reset ma sens głównie wtedy, gdy konto mogło zostać przejęte — zostawienie działających sesji
// mijałoby się wtedy z jego celem.
const tokReset = await login('suhaslo', 'haslo123');
ok((await as(tokReset)('/auth/me')).status === 200, 'przed resetem hasła token działa');

await j(await aAdmin(`/employees/${resetowany.id}/password`, { method: 'PUT', body: JSON.stringify({ password: 'nowe-haslo-456' }) }));
ok((await as(tokReset)('/auth/me')).status === 401, 'po resecie hasła TEN SAM token przestaje działać');

// Konto nie może zostać zablokowane na stałe: nowe hasło daje sesję, która normalnie działa.
// Logowanie idzie NATYCHMIAST po resecie, czyli zwykle w tej samej sekundzie — a `iat` ma
// rozdzielczość sekundową. Zbyt ostrożne porównanie unieważniłoby tu świeży token i zamknęło
// osobę poza kontem, któremu administrator dopiero co ustawił hasło.
const tokPoResecie = await login('suhaslo', 'nowe-haslo-456');
ok((await as(tokPoResecie)('/auth/me')).status === 200, 'logowanie nowym hasłem daje działającą sesję (nawet w tej samej sekundzie)');
ok((await as(tokPoResecie)(`/absences?employeeId=${resetowany.id}`)).status === 200, 'świeża sesja obsługuje zwykłe żądania, nie tylko /auth/me');

// --- KONTROLA POZYTYWNA ---------------------------------------------------------------------
// Naprawa nie może zamienić się w wylogowywanie wszystkich przy każdej zmianie w bazie.
await j(await aAdmin(`/employees/${cel.id}/employment-type`, { method: 'PATCH', body: JSON.stringify({ employmentType: 'B2B' }) }));
ok((await as(tokMod)('/auth/me')).status === 200, 'niezwiązana zmiana w bazie nie unieważnia cudzej sesji');
ok((await aAdmin('/audit')).status === 200, 'sesja administratora żyje przez cały przebieg');

await prisma.$disconnect();
console.log(failures === 0 ? '\nUNIEWAŻNIANIE SESJI OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
