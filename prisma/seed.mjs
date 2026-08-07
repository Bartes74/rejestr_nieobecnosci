// Seed startowy: administrator + podstawowa konfiguracja, by aplikacja była od razu używalna.
// Idempotentny. Uruchom: `pnpm db:seed`.
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

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

  await prisma.adminSetting.upsert({
    where: { key: 'leavePool.default' },
    create: { key: 'leavePool.default', value: '26' },
    update: {},
  });

  // Kolejność listy bierze się z `sortOrder`, nie z alfabetu — stąd jawne numery zamiast
  // polegania na pozycji w tablicy. Urlop wypoczynkowy pierwszy, bo to on jest domyślnym
  // wyborem w formularzu wpisu; L4 na końcu, bo nie planuje się choroby z wyprzedzeniem.
  const TYPES = [
    { name: 'Urlop wypoczynkowy', sortOrder: 0 },
    { name: 'Urlop na żądanie', sortOrder: 1 },
    { name: 'L4', affectsPool: false, specialCategory: true, sortOrder: 2 },
  ];
  for (const t of TYPES) {
    if (!(await prisma.absenceType.findFirst({ where: { name: t.name } }))) {
      await prisma.absenceType.create({ data: t });
    }
  }

  if (!(await prisma.holidayCalendar.findFirst({ where: { isDefault: true } }))) {
    await prisma.holidayCalendar.create({ data: { name: 'Polska', isDefault: true } });
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
