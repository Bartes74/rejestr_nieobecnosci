// Seed startowy: administrator + podstawowa konfiguracja, by aplikacja była od razu używalna.
// Idempotentny. Uruchom: `pnpm db:seed`.
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';
// Rdzeń kompiluje się do CommonJS; import nazwany działa dzięki `exports.polishHolidays = …`
// (ten sam wzorzec co w apps/api/demo-seed.mjs). Wymaga zbudowanego `packages/core/dist`.
import { polishHolidays } from '../packages/core/dist/holidays-pl.js';
import { todayUtc } from '../packages/core/dist/today.js';

const prisma = new PrismaClient();

// Mirror auth.service.hashPassword (scrypt, format "salt:hash").
const hash = (p) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(p, salt, 64).toString('hex')}`;
};

async function main() {
  if (!(await prisma.employee.findUnique({ where: { login: 'admin' } }))) {
    await prisma.employee.create({
      data: {
        firstName: 'Administrator', lastName: 'Systemu', email: 'admin@firma.example',
        login: 'admin', role: 'ADMIN', employmentType: 'UOP',
        startDate: new Date('2026-01-01'), passwordHash: hash('admin'),
      },
    });
    console.log('• Administrator: login "admin", hasło "admin" — ZMIEŃ po pierwszym logowaniu.');
  }

  // Zamawiający: UoP 26 dni (Kodeks pracy), B2B i OUT co najmniej 20 — z możliwością ustawienia
  // większej w Konfiguracji. `update: {}` — ponowny seed nie nadpisuje tego, co administrator
  // już zmienił, ale na instancji, która miała samą pulę wspólną, DODA klucze B2B/OUT = 20.
  for (const [key, value] of [['leavePool.default', '26'], ['leavePool.B2B', '20'], ['leavePool.OUT', '20']]) {
    await prisma.adminSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  }

  // Kolejność listy bierze się z `sortOrder`, nie z alfabetu — stąd jawne numery zamiast
  // polegania na pozycji w tablicy. Nieobecność pierwsza, bo to ona jest domyślnym
  // wyborem w formularzu wpisu; L4 na końcu, bo nie planuje się choroby z wyprzedzeniem.
  //
  // Dwa typy, nie trzy: „Urlop wypoczynkowy" i „Urlop na żądanie" to kategorie Kodeksu
  // pracy, więc opisują wyłącznie UoP — dla B2B i OUT są nieprawdziwe. Systemowo i tak nic
  // ich nie różniło (identyczne flagi), a użytkownik musiał wybierać między opcjami
  // robiącymi to samo.
  const TYPES = [
    { name: 'Nieobecność', sortOrder: 0 },
    { name: 'L4', affectsPool: false, specialCategory: true, sortOrder: 1 },
  ];
  // Zbieżność istniejących baz. Seed dopasowuje typy po nazwie, więc bez tego stara baza
  // dostałaby czwarty wiersz obok trzech poprzednich. Zmiana nazwy w miejscu (a nie nowy
  // typ) zachowuje `id`, więc dotychczasowe wpisy dalej wskazują na swój typ.
  await prisma.absenceType.updateMany({ where: { name: 'Urlop wypoczynkowy' }, data: { name: 'Nieobecność', sortOrder: 0 } });
  // Usuwamy tylko typ, którego nikt nie użył. `Absence.typeId` to klucz obcy bez kaskady —
  // przy zajętym typie delete i tak by się wywalił, a seed ma przejść i zostawić decyzję
  // administratorowi, nie przerwać się błędem FK.
  await prisma.absenceType.deleteMany({ where: { name: 'Urlop na żądanie', absences: { none: {} } } });
  for (const t of TYPES) {
    if (!(await prisma.absenceType.findFirst({ where: { name: t.name } }))) {
      await prisma.absenceType.create({ data: t });
    }
  }

  // FR-G3/G7 — kalendarz domyślny ze świętami ustawowymi na bieżący i następny rok. Wcześniej seed
  // tworzył kalendarz pusty, a import był ręczny per rok — osoba bez kalendarza liczyła 11 listopada
  // jako dzień pracy. Idempotentne: unikalność (calendarId, date); scheduler dopisuje kolejne lata.
  const cal = (await prisma.holidayCalendar.findFirst({ where: { isDefault: true } }))
    ?? (await prisma.holidayCalendar.create({ data: { name: 'Polska', isDefault: true } }));
  const year = todayUtc().getUTCFullYear();
  for (const y of [year, year + 1]) {
    await prisma.holiday.createMany({ data: polishHolidays(y).map((h) => ({ ...h, calendarId: cal.id })), skipDuplicates: true });
  }

  // FR-J3 — rejestr czynności przetwarzania (RODO, art. 30).
  if ((await prisma.processingActivity.count()) === 0) {
    await prisma.processingActivity.createMany({ data: [
      { name: 'Ewidencja nieobecności', purpose: 'Planowanie i rozliczanie nieobecności oraz capacity zespołów.', legalBasis: 'art. 6 ust. 1 lit. f RODO (uzasadniony interes) oraz Kodeks pracy.', dataCategories: 'Imię, nazwisko, e-mail, forma zatrudnienia, daty i typy nieobecności.', recipients: 'Przełożeni, PO/Agile PM, PMO.', retention: 'Do 24 mies. po ustaniu zatrudnienia/współpracy (konfigurowalne).', specialCategory: false },
      { name: 'Zwolnienia lekarskie (L4)', purpose: 'Wyliczenie capacity; fakt nieobecności chorobowej.', legalBasis: 'art. 9 ust. 2 lit. b RODO (obowiązki z prawa pracy i zabezpieczenia społecznego).', dataCategories: 'Fakt zwolnienia chorobowego (dana o zdrowiu — kategoria szczególna).', recipients: 'Administrator i osoby z uprawnieniem rozszerzonym (VIEW_L4).', retention: 'Jak ewidencja nieobecności.', specialCategory: true },
      { name: 'Konta i uwierzytelnianie', purpose: 'Bezpieczny dostęp do systemu.', legalBasis: 'art. 6 ust. 1 lit. f RODO.', dataCategories: 'Login, skrót hasła (scrypt).', recipients: 'Administrator.', retention: 'Czas korzystania z systemu.', specialCategory: false },
      { name: 'Dziennik audytu i zdarzeń bezpieczeństwa', purpose: 'Rozliczalność, wykrywanie nadużyć, bezpieczeństwo.', legalBasis: 'art. 6 ust. 1 lit. c oraz f RODO.', dataCategories: 'Identyfikator użytkownika, rodzaj operacji, znacznik czasu, opis.', recipients: 'Administrator.', retention: 'Jak ewidencja nieobecności.', specialCategory: false },
    ] });
    console.log('• Rejestr czynności przetwarzania (RODO): 4 wpisy.');
  }

  console.log('Seed gotowy.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
