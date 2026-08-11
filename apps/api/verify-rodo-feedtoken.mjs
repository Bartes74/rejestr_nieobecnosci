// FR-J1 + FR-J2 (regresja bezpieczeństwa): token kanału iCal jako droga obejścia ochrony L4.
//
// Kanał iCal jest trasą PUBLICZNĄ — klienty kalendarza nie wysyłają nagłówka Bearer, więc
// uwierzytelnia go sam token w adresie. Token pełni tym samym rolę hasła. Katalog pracowników
// oddawał go razem z resztą wiersza (`omit` usuwa wyłącznie pola wskazane wprost), a katalog
// widzi dyrektor, PMO i każdy z uprawnieniem MODIFY_ABSENCE — czyli role, którym `canViewL4`
// odmawia wglądu w znacznik kategorii szczególnej. Wystarczyło wziąć cudzy token z katalogu,
// żeby przeczytać nazwy typów wprost i bez wpisu VIEW_TYPES w dzienniku.
//
// Druga część suity pilnuje anonimizacji: token, który ją przeżywał, dalej oddawał pełną
// historię osoby, która skorzystała z prawa do bycia zapomnianym.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';

const API = process.env.API ?? 'http://localhost:3100/api';
const prisma = new PrismaClient();
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };
const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const login = async (l, p) => (await j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: l, password: p }) }))).token;
const as = (t) => (p, o = {}) => fetch(API + p, { ...o, headers: { 'content-type': 'application/json', authorization: `Bearer ${t}`, ...(o.headers || {}) } });

for (let i = 0; i < 30; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const mk = (login, role) => prisma.employee.create({ data: { firstName: login, lastName: 'FT', email: `${login}@x.pl`, login, role, employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
await mk('ftadmin', 'ADMIN');
await mk('ftdyr', 'DIRECTOR');
await mk('ftpmo', 'PMO');
const mod = await mk('ftmod', 'EMPLOYEE');
await prisma.permission.create({ data: { employeeId: mod.id, scope: 'MODIFY_ABSENCE' } });
const anna = await mk('ftanna', 'EMPLOYEE');

// Wpis kategorii szczególnej — to jego nazwa jest tym, co miało nie wyciec.
const l4 = await prisma.absenceType.create({ data: { name: 'L4 SEKRET FEEDTOKEN', affectsPool: false, specialCategory: true } });
await prisma.absence.create({ data: { employeeId: anna.id, typeId: l4.id, dateFrom: new Date('2026-06-08'), dateTo: new Date('2026-06-10') } });

// --- KATALOG NIE ODDAJE POŚWIADCZEŃ --------------------------------------------------------
// Wszystkie cztery role widzą katalog całej firmy (role ogólnofirmowe wprost, MODIFY_ABSENCE
// jako uprawnienie delegowane działające poza własnym Tribe).
for (const [nazwa, l] of [['administrator', 'ftadmin'], ['dyrektor', 'ftdyr'], ['PMO', 'ftpmo'], ['MODIFY_ABSENCE', 'ftmod']]) {
  const rows = await j(await as(await login(l, 'haslo123'))('/employees'));
  ok(rows.length > 0 && rows.every((e) => e.feedToken === undefined), `${nazwa}: katalog nie ujawnia feedToken`);
  ok(rows.every((e) => e.passwordHash === undefined), `${nazwa}: katalog nie ujawnia passwordHash`);
}

// --- M3: UPRAWNIENIE DELEGOWANE NIE OTWIERA WIDOKU ADMINISTRACYJNEGO ------------------------
// Regresja minimalizacji danych. MODIFY_ABSENCE nadaje się imiennie osobie z rolą EMPLOYEE,
// żeby wpisywała nieobecności za innych — potrzebuje więc listy osób z całej firmy, ale nie
// ich kontaktów ani mapy „kto ma jakie uprawnienie" (ta ostatnia to gotowa lista celów:
// komu warto przejąć konto, żeby zobaczyć znacznik L4).
const wierszeMod = await j(await as(await login('ftmod', 'haslo123'))('/employees'));
ok(wierszeMod.every((e) => e.email === undefined), 'MODIFY_ABSENCE: katalog nie ujawnia e-maili');
ok(wierszeMod.every((e) => e.login === undefined), 'MODIFY_ABSENCE: katalog nie ujawnia loginów');
ok(wierszeMod.every((e) => e.permissions === undefined), 'MODIFY_ABSENCE: katalog nie ujawnia mapy uprawnień');
ok(wierszeMod.every((e) => e.role === undefined), 'MODIFY_ABSENCE: katalog nie ujawnia ról');
// Zasięg zostaje szeroki — inaczej naprawa zabrałaby funkcję, dla której uprawnienie istnieje.
ok(wierszeMod.some((e) => e.id === anna.id) && wierszeMod.length >= 5,
  'MODIFY_ABSENCE: nadal widzi osoby z całej firmy (id + imię i nazwisko wystarczą do wskazania)');
ok(wierszeMod.every((e) => e.firstName && e.lastName), 'MODIFY_ABSENCE: imię i nazwisko zostają — po nich wybiera się osobę');

// Mapa uprawnień idzie wyłącznie do administratora; dyrektor katalog z kontaktami ma, mapy nie.
const wierszeAdmin = await j(await as(await login('ftadmin', 'haslo123'))('/employees'));
ok(wierszeAdmin.some((e) => Array.isArray(e.permissions)), 'administrator: mapa uprawnień nadal dostępna (ekran Pracownicy nią zarządza)');
const wierszeDyr = await j(await as(await login('ftdyr', 'haslo123'))('/employees'));
ok(wierszeDyr.every((e) => e.permissions === undefined), 'dyrektor: katalog bez mapy uprawnień');
ok(wierszeDyr.some((e) => e.email !== undefined), 'dyrektor: kontakty zostają (katalog zarządczy)');

// Ten sam warunek na surowej treści odpowiedzi — gdyby pole wróciło pod inną nazwą.
await prisma.employee.update({ where: { id: anna.id }, data: { feedToken: 'ft-token-kontrolny' } });
const surowy = await (await as(await login('ftdyr', 'haslo123'))('/employees')).text();
ok(!surowy.includes('ft-token-kontrolny'), 'wartość tokenu nie pojawia się nigdzie w treści katalogu');

// --- TOKEN NADAL DZIAŁA DLA WŁAŚCICIELA -----------------------------------------------------
// Naprawa nie może zabrać funkcji: własny token pobiera się przez /me/feed-token.
const aAnna = as(await login('ftanna', 'haslo123'));
const mojToken = (await j(await aAnna('/me/feed-token'))).token;
ok(typeof mojToken === 'string' && mojToken.length > 0, 'właściciel nadal pobiera swój token kanału');
const mojKanal = await (await fetch(`${API}/feed/me.ics?token=${mojToken}`)).text();
ok(mojKanal.includes('L4 SEKRET FEEDTOKEN'), 'własny kanał nadal pokazuje typy (to dane właściciela)');

// --- ANONIMIZACJA UNIEWAŻNIA KANAŁ ----------------------------------------------------------
const aAdmin = as(await login('ftadmin', 'haslo123'));
ok((await j(await aAdmin(`/employees/${anna.id}/anonymize`, { method: 'POST' }))).anonymized === true, 'anonimizacja wykonana');
ok((await fetch(`${API}/feed/me.ics?token=${mojToken}`)).status === 404, 'kanał po anonimizacji przestaje działać (FR-J2)');
ok((await prisma.employee.findUnique({ where: { id: anna.id } })).feedToken === null, 'anonimizacja czyści feedToken w bazie');

// Historia nieobecności zostaje — anonimizacja usuwa dane osobowe, nie zapisy (integralność).
ok((await prisma.absence.count({ where: { employeeId: anna.id } })) === 1, 'wpisy nieobecności przetrwały anonimizację');

await prisma.$disconnect();
console.log(failures === 0 ? '\nRODO / FEEDTOKEN OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
