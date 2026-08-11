// Faza 2: FR-J3 — rejestr czynności przetwarzania (RODO) dostępny dla administratora.
import { API, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

const as = (t) => (p, o = {}) => fetch(API + p, { ...o, headers: { authorization: `Bearer ${t}`, ...(o.headers || {}) } });

await waitForApi();

// rejestr (seedowany globalnie, ale suita czyni się samowystarczalna)
if ((await prisma.processingActivity.count()) === 0) {
  await prisma.processingActivity.createMany({ data: [
    { name: 'Ewidencja nieobecności', purpose: 'Planowanie i rozliczanie nieobecności.', legalBasis: 'art. 6 ust. 1 lit. f RODO.', dataCategories: 'Imię, nazwisko, e-mail, forma, daty.', recipients: 'Przełożeni, PMO.', retention: 'Do 24 mies. po ustaniu zatrudnienia.', specialCategory: false },
    { name: 'Zwolnienia lekarskie (L4)', purpose: 'Wyliczenie capacity.', legalBasis: 'art. 9 ust. 2 lit. b RODO.', dataCategories: 'Fakt L4 (dana o zdrowiu).', recipients: 'Administrator, uprawnieni.', retention: 'Jak ewidencja.', specialCategory: true },
    { name: 'Konta i uwierzytelnianie', purpose: 'Dostęp do systemu.', legalBasis: 'art. 6 ust. 1 lit. f RODO.', dataCategories: 'Login, skrót hasła.', recipients: 'Administrator.', retention: 'Czas korzystania.', specialCategory: false },
    { name: 'Dziennik audytu', purpose: 'Rozliczalność i bezpieczeństwo.', legalBasis: 'art. 6 ust. 1 lit. c oraz f RODO.', dataCategories: 'Użytkownik, operacja, czas.', recipients: 'Administrator.', retention: 'Jak ewidencja.', specialCategory: false },
  ] });
}
const mk = (login, role) => prisma.employee.create({ data: { firstName: login, lastName: 'J3', email: `${login}@x.pl`, login, role, employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
await mk('j3admin', 'ADMIN');
await mk('j3worker', 'EMPLOYEE');

const reg = await j(await as(await login('j3admin', 'haslo123'))('/processing-register'));
ok(reg.length >= 4, `rejestr ma wpisy (${reg.length})`);
ok(reg.some((a) => a.specialCategory === true && /L4|chorob/i.test(a.name)), 'rejestr zawiera kategorię szczególną (L4 — dane o zdrowiu)');
ok(reg.every((a) => a.legalBasis && a.purpose && a.retention), 'każdy wpis ma cel, podstawę prawną i retencję');
ok((await as(await login('j3worker', 'haslo123'))('/processing-register')).status === 403, 'pracownik nie ma dostępu do rejestru → 403');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 2 (rejestr RODO) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
