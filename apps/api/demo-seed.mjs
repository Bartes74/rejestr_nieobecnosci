// Dane demo: jeden login na rolę + zespół z nieobecnościami, sprintem i zaległym urlopem.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';

const prisma = new PrismaClient();
const D = (s) => new Date(s);

async function main() {
  // czyszczenie
  await prisma.auditLog.deleteMany(); await prisma.absence.deleteMany(); await prisma.leaveAllowance.deleteMany();
  await prisma.permission.deleteMany(); await prisma.orgUnitMembership.deleteMany(); await prisma.sprint.deleteMany();
  await prisma.holiday.deleteMany(); await prisma.employee.deleteMany(); await prisma.orgUnit.deleteMany();
  await prisma.holidayCalendar.deleteMany(); await prisma.absenceType.deleteMany(); await prisma.processingActivity.deleteMany();
  await prisma.adminSetting.deleteMany();

  // konfiguracja
  await prisma.adminSetting.create({ data: { key: 'leavePool.default', value: '26' } });
  await prisma.holidayCalendar.create({ data: { name: 'Polska', isDefault: true } });
  const urlop = await prisma.absenceType.create({ data: { name: 'Urlop wypoczynkowy' } });
  await prisma.absenceType.create({ data: { name: 'Urlop na żądanie' } });
  const l4 = await prisma.absenceType.create({ data: { name: 'L4', affectsPool: false, specialCategory: true } });
  await prisma.processingActivity.createMany({ data: [
    { name: 'Ewidencja nieobecności', purpose: 'Planowanie i rozliczanie nieobecności oraz capacity zespołów.', legalBasis: 'art. 6 ust. 1 lit. f RODO oraz Kodeks pracy.', dataCategories: 'Imię, nazwisko, e-mail, forma zatrudnienia, daty i typy nieobecności.', recipients: 'Przełożeni, PO/Agile PM, PMO.', retention: 'Do 24 mies. po ustaniu zatrudnienia.', specialCategory: false },
    { name: 'Zwolnienia lekarskie (L4)', purpose: 'Wyliczenie capacity; fakt nieobecności chorobowej.', legalBasis: 'art. 9 ust. 2 lit. b RODO.', dataCategories: 'Fakt L4 (dana o zdrowiu — kategoria szczególna).', recipients: 'Administrator i osoby z uprawnieniem VIEW_L4.', retention: 'Jak ewidencja nieobecności.', specialCategory: true },
    { name: 'Konta i uwierzytelnianie', purpose: 'Bezpieczny dostęp do systemu.', legalBasis: 'art. 6 ust. 1 lit. f RODO.', dataCategories: 'Login, skrót hasła (scrypt).', recipients: 'Administrator.', retention: 'Czas korzystania z systemu.', specialCategory: false },
    { name: 'Dziennik audytu i zdarzeń bezpieczeństwa', purpose: 'Rozliczalność, wykrywanie nadużyć, bezpieczeństwo.', legalBasis: 'art. 6 ust. 1 lit. c oraz f RODO.', dataCategories: 'Identyfikator użytkownika, operacja, znacznik czasu.', recipients: 'Administrator.', retention: 'Jak ewidencja nieobecności.', specialCategory: false },
  ] });

  // struktura: Pion › Departament › Tribe › Squad
  const pion = await prisma.orgUnit.create({ data: { name: 'Pion Operacji', type: 'PION' } });
  const dept = await prisma.orgUnit.create({ data: { name: 'Departament IT', type: 'DEPARTAMENT', parentId: pion.id } });
  const tribe = await prisma.orgUnit.create({ data: { name: 'Tribe Alfa', type: 'TRIBE', parentId: dept.id } });
  const squad = await prisma.orgUnit.create({ data: { name: 'Squad A1', type: 'SQUAD', parentId: tribe.id } });

  const mk = (first, last, login, role, pwd, extra = {}) => prisma.employee.create({
    data: { firstName: first, lastName: last, email: `${login}@firma.example`, login, role, employmentType: extra.emp ?? 'UOP', isKeyRole: extra.key ?? false, startDate: D('2026-01-01'), passwordHash: hashPassword(pwd) },
  });

  const admin = await mk('Administrator', 'Systemu', 'admin', 'ADMIN', 'admin');
  await mk('Dyrektor', 'Demo', 'dyrektor', 'DIRECTOR', 'demo123');
  await mk('PMO', 'Demo', 'pmo', 'PMO', 'demo123');
  const lider = await mk('Lider', 'Demo', 'lider', 'LEADER', 'demo123');
  const po = await mk('Product', 'Owner', 'po', 'PO', 'demo123');
  const prac = await mk('Pracownik', 'Demo', 'pracownik', 'EMPLOYEE', 'demo123');
  const anna = await mk('Anna', 'Kowalska', 'anna', 'EMPLOYEE', 'demo123', { key: true });
  const bartek = await mk('Bartek', 'Nowak', 'bartek', 'EMPLOYEE', 'demo123', { key: true });
  const celina = await mk('Celina', 'Zielińska', 'celina', 'EMPLOYEE', 'demo123', { emp: 'B2B' });

  // wszyscy z zespołu w Squad A1 (lider/po też — żeby widzieli i liczyli się do capacity)
  await prisma.orgUnitMembership.createMany({ data: [lider, po, prac, anna, bartek, celina].map((e) => ({ employeeId: e.id, orgUnitId: squad.id })) });

  // pracownik: zaległy urlop (przypomnienie + „kto zalega")
  await prisma.leaveAllowance.create({ data: { employeeId: prac.id, periodYear: 2026, baseDays: 26, carriedOver: 3 } });

  // nieobecności (dziś = 23.06.2026)
  await prisma.absence.createMany({ data: [
    { employeeId: anna.id, typeId: urlop.id, dateFrom: D('2026-06-22'), dateTo: D('2026-06-24') }, // kluczowa rola
    { employeeId: bartek.id, typeId: urlop.id, dateFrom: D('2026-06-23'), dateTo: D('2026-06-25') }, // kolizja z Anną 23–24
    { employeeId: celina.id, typeId: urlop.id, dateFrom: D('2026-06-26'), dateTo: D('2026-06-26') }, // B2B
    { employeeId: prac.id, typeId: urlop.id, dateFrom: D('2026-06-29'), dateTo: D('2026-06-30') }, // własny wpis pracownika
    { employeeId: anna.id, typeId: l4.id, dateFrom: D('2026-07-06'), dateTo: D('2026-07-07') }, // L4 (nie obniża puli)
  ] });

  // sprint obejmujący bieżący tydzień
  await prisma.sprint.create({ data: { name: 'Sprint 13', dateFrom: D('2026-06-22'), dateTo: D('2026-07-03'), squadId: squad.id } });

  // === Pełniejsze dane do Heatmapy pokrycia (C4) i Capacity: dodatkowe squady, sprinty, nieobecności ===
  const extraSquads = [];
  for (const name of ['Squad Onboarding', 'Squad Mobilny', 'Squad Rozliczenia', 'Squad Integracje']) {
    extraSquads.push(await prisma.orgUnit.create({ data: { name, type: 'SQUAD', parentId: tribe.id } }));
  }
  const surnames = [['Marta', 'Wiśniewska'], ['Rafał', 'Kamiński'], ['Tomasz', 'Lewandowski'], ['Katarzyna', 'Zielińska'], ['Jakub', 'Wójcik'], ['Magdalena', 'Dąbrowska'], ['Piotr', 'Mazur'], ['Ewa', 'Krawczyk'], ['Grzegorz', 'Woźniak'], ['Joanna', 'Kaczmarek'], ['Michał', 'Szymański'], ['Aleksandra', 'Wojciechowska']];
  const squadMembers = []; // [{ id, members: [employeeId] }]
  let gi = 0;
  for (const sq of extraSquads) {
    const members = [];
    for (let x = 0; x < 3; x++) {
      const [f, l] = surnames[gi % surnames.length]; gi++;
      const e = await prisma.employee.create({ data: { firstName: f, lastName: l, email: `extra${gi}@firma.example`, login: `extra${gi}`, role: 'EMPLOYEE', employmentType: gi % 4 === 0 ? 'B2B' : 'UOP', startDate: D('2026-01-01') } });
      members.push(e.id);
    }
    squadMembers.push({ id: sq.id, members });
    await prisma.orgUnitMembership.createMany({ data: members.map((id) => ({ employeeId: id, orgUnitId: sq.id })) });
  }

  // sprinty S8..S14 (dwutygodniowe); Sprint 13 = bieżący (utworzony wyżej)
  const sprintWindows = [
    ['Sprint 8', '2026-03-30', '2026-04-10'], ['Sprint 9', '2026-04-13', '2026-04-24'],
    ['Sprint 10', '2026-04-27', '2026-05-08'], ['Sprint 11', '2026-05-11', '2026-05-22'],
    ['Sprint 12', '2026-05-25', '2026-06-05'], ['Sprint 14', '2026-07-06', '2026-07-17'],
  ];
  for (const [name, f, t] of sprintWindows) await prisma.sprint.create({ data: { name, dateFrom: D(f), dateTo: D(t), squadId: squad.id } });

  // nieobecności rozłożone tak, by % pokrycia tworzyło pełny gradient (zielony→czerwony) w heatmapie
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d; };
  const heatAbs = [];
  squadMembers.forEach(({ members }, si) => {
    sprintWindows.forEach(([, from], ti) => {
      const intensity = (si * 3 + ti * 5) % 10;            // deterministyczny rozrzut 0..9
      const absent = Math.min(members.length, Math.round(intensity / 2.6)); // 0..N osób
      const span = 1 + (intensity % 5);                    // długość 1..5 dni → wyższe % aż do czerwieni
      for (let m = 0; m < absent; m++) {
        heatAbs.push({ employeeId: members[m], typeId: urlop.id, dateFrom: addDays(from, 1 + m), dateTo: addDays(from, 1 + m + span) });
      }
    });
  });
  await prisma.absence.createMany({ data: heatAbs });

  console.log('Demo gotowe. Logowanie poniżej.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
