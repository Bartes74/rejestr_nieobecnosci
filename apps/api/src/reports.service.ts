import { Injectable } from '@nestjs/common';
import { balance, consumesPool, countOverlaidDays, dayFraction, isoDate, resolveBillingPeriod, todayUtc, usedLeaveDays, usedLeaveDaysUntil } from '@nieobecnosci/core';
import ExcelJS from 'exceljs';
import { PrismaService } from './prisma.service';
import { OrgService } from './org.service';
import { BalanceService, poolAndCarry } from './balance.service';
import { SettingsService } from './settings.service';
import type { AuthUser } from './auth/current-user.decorator';
import { canViewL4 } from './auth/rbac';

// FR-F6 — stabilny, wersjonowany schemat eksportu dla płac/PMO. Zmiany → bump wersji.
const PAYROLL_SCHEMA_VERSION = '1.1';

export interface UsageRow {
  employeeId: string;
  name: string;
  employmentType: string;
  pool: number;
  carriedOver: number;
  used: number; // zaplanowano — wszystkie dni w okresie, także przyszłe
  realized: number; // z tego zrealizowano do dziś
  remaining: number;
}
export interface UsageTotals { pool: number; carriedOver: number; used: number; realized: number; remaining: number }
// Węzeł drzewa niesie komplet liczb jednostki (feedback002: dyrektor porównuje Tribe'y i departament
// w jednej tabeli). `used` zostaje nazwą „zaplanowano" — suity i eksport na niej stoją.
export interface TreeNode extends UsageTotals {
  id: string;
  name: string;
  type: string;
  headcount: number;
  overdueCount: number; // osób z pozostało ≥ próg zalegania
  children: TreeNode[];
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly org: OrgService,
    private readonly balance: BalanceService,
    private readonly settings: SettingsService,
  ) {}

  // FR-F2 — wykorzystanie urlopu per pracownik w jednostce (z poddrzewem).
  // Liczone wsadowo (kilka zapytań na cały zbiór), nie po jednym na osobę.
  async usage(unitId: string): Promise<{ unitId: string; rows: UsageRow[]; totals: UsageTotals }> {
    const memberIds = await this.org.employeeIdsInUnit(unitId);
    const [employees, allowances, absences, defaultPools, defaultHolidays] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: memberIds } }, include: { holidayCalendar: { include: { holidays: true } } } }),
      this.prisma.leaveAllowance.findMany({ where: { employeeId: { in: memberIds } } }),
      this.prisma.absence.findMany({ where: { employeeId: { in: memberIds } }, include: { type: true } }),
      this.balance.defaultPools(),
      this.balance.defaultHolidays(),
    ]);

    // Wszystkie okresy osoby, nie tylko bieżący: urlop zaległy wynika z okresów wcześniejszych.
    const allowByEmp = new Map<string, typeof allowances>();
    for (const a of allowances) (allowByEmp.get(a.employeeId) ?? allowByEmp.set(a.employeeId, []).get(a.employeeId)!).push(a);
    const absByEmp = new Map<string, typeof absences>();
    for (const a of absences) (absByEmp.get(a.employeeId) ?? absByEmp.set(a.employeeId, []).get(a.employeeId)!).push(a);

    const now = todayUtc(); // dzień w strefie organizacji — patrz komentarz w balance.service
    const rows: UsageRow[] = employees.map((e) => {
      const period = resolveBillingPeriod(e.employmentType, now);
      const holidays = this.balance.holidaysOf(e, defaultHolidays);
      // Pula i zaległe (FR-B3/B7/B9) tą samą funkcją co licznik na pulpicie — raport pokazujący
      // inną liczbę zaległych dni niż pulpit byłby gorszy niż brak raportu.
      const { pool, carriedOver } = poolAndCarry(
        e, period, allowByEmp.get(e.id) ?? [], absByEmp.get(e.id) ?? [], holidays, defaultPools[e.employmentType],
      );
      const spans = (absByEmp.get(e.id) ?? []).map((a) => ({
        dateFrom: a.dateFrom, dateTo: a.dateTo,
        affectsPool: consumesPool(e.employmentType, a.type.affectsPool), // FR-B5 — jak w BalanceService
        overrides: !a.type.affectsPool,
        fraction: dayFraction(a.dayPart, a.hourFrom ?? undefined, a.hourTo ?? undefined),
      }));
      const used = usedLeaveDays(spans, period, holidays);
      const realized = usedLeaveDaysUntil(spans, period, now, holidays);
      return { employeeId: e.id, name: `${e.firstName} ${e.lastName}`, employmentType: e.employmentType, ...balance(pool, carriedOver, used), realized };
    }).sort((a, b) => a.name.localeCompare(b.name, 'pl'));

    // RAZEM z zaległymi: kolumna w raporcie nazywa się „Pula+zaległe", a suma pomijała zaległe,
    // więc wiersz RAZEM nie zgadzał się z własną kolumną (feedback002).
    const totals = rows.reduce(
      (t, r) => ({ pool: t.pool + r.pool, carriedOver: t.carriedOver + r.carriedOver, used: t.used + r.used, realized: t.realized + r.realized, remaining: t.remaining + r.remaining }),
      { pool: 0, carriedOver: 0, used: 0, realized: 0, remaining: 0 },
    );
    return { unitId, rows, totals };
  }

  // FR-F5 — „kto zalega": osoby, którym pozostało co najmniej tyle dni, ile mówi próg z konfiguracji
  // administratora („Próg zalegania"). Jedna definicja: wcześniej flaga `zalega` stała na samych dniach
  // przeniesionych z poprzednich okresów, a próg tylko poszerzał listę — ustawienie nie miało widocznego
  // skutku na ekranie (feedback002). Zaległe z poprzednich okresów zostają informacyjnie w wierszu.
  async overdue(unitId: string, threshold?: number) {
    if (threshold === undefined) threshold = await this.settings.getNumber('overdue.threshold');
    const { rows } = await this.usage(unitId);
    const flagged = rows
      .filter((r) => r.remaining >= threshold)
      .map((r) => ({ ...r, zalega: true }))
      .sort((a, b) => b.remaining - a.remaining || b.carriedOver - a.carriedOver);
    return { unitId, threshold, rows: flagged };
  }

  // FR-F3 — drążenie hierarchii: każdy węzeł agreguje unikalnych pracowników z poddrzewa.
  async tree(unitId: string): Promise<TreeNode> {
    const [units, memberships, usage, threshold] = await Promise.all([
      this.prisma.orgUnit.findMany(),
      this.prisma.orgUnitMembership.findMany(),
      this.usage(unitId),
      this.settings.getNumber('overdue.threshold'),
    ]);
    const byId = new Map(units.map((u) => [u.id, u]));
    const rowByEmp = new Map(usage.rows.map((r) => [r.employeeId, r]));
    const childrenOf = new Map<string, string[]>();
    const membersOf = new Map<string, string[]>();
    for (const u of units) if (u.parentId) (childrenOf.get(u.parentId) ?? childrenOf.set(u.parentId, []).get(u.parentId)!).push(u.id);
    for (const m of memberships) (membersOf.get(m.orgUnitId) ?? membersOf.set(m.orgUnitId, []).get(m.orgUnitId)!).push(m.employeeId);

    const build = (id: string): TreeNode => {
      const u = byId.get(id)!;
      const emp = new Set<string>();
      const collect = (uid: string) => {
        for (const e of membersOf.get(uid) ?? []) emp.add(e);
        for (const c of childrenOf.get(uid) ?? []) collect(c);
      };
      collect(id);
      const sums = { pool: 0, carriedOver: 0, used: 0, realized: 0, remaining: 0, overdueCount: 0 };
      for (const e of emp) {
        const r = rowByEmp.get(e);
        if (!r) continue;
        sums.pool += r.pool; sums.carriedOver += r.carriedOver; sums.used += r.used; sums.realized += r.realized; sums.remaining += r.remaining;
        if (r.remaining >= threshold) sums.overdueCount++;
      }
      return { id, name: u.name, type: u.type, headcount: emp.size, ...sums, children: (childrenOf.get(id) ?? []).map(build) };
    };
    return build(unitId);
  }

  // FR-F1 / FR-J4 — eksport .xlsx. Zawiera tylko dni (pula/wykorzystano/pozostało),
  // nigdy typu ani znacznika L4 → bezpieczny dla każdej roli raportowej.
  async usageXlsx(unitId: string): Promise<Buffer> {
    const { rows, totals } = await this.usage(unitId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Wykorzystanie urlopu');
    ws.columns = [
      { header: 'Pracownik', key: 'name', width: 28 },
      { header: 'Forma', key: 'employmentType', width: 8 },
      { header: 'Pula', key: 'pool', width: 8 },
      { header: 'Zaległe', key: 'carriedOver', width: 9 },
      { header: 'Wykorzystano', key: 'used', width: 13 },
      { header: 'Pozostało', key: 'remaining', width: 11 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.addRow({});
    ws.addRow({ name: 'RAZEM', pool: totals.pool, carriedOver: totals.carriedOver, used: totals.used, remaining: totals.remaining }).font = { bold: true };
    // ponytail: cast typów (exceljs Buffer vs Node Buffer); runtime to prawdziwy Buffer.
    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  // FR-F6 — eksport pod płace/PMO o stabilnym, wersjonowanym schemacie. RODO-safe:
  // dni kategorii szczególnej (L4) dołączane wyłącznie dla uprawnionych (VIEW_L4/admin).
  async payrollExport(unitId: string, user: AuthUser) {
    const memberIds = await this.org.employeeIdsInUnit(unitId);
    const [employees, absences, defaultHolidays] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: memberIds } }, include: { holidayCalendar: { include: { holidays: true } } } }),
      this.prisma.absence.findMany({ where: { employeeId: { in: memberIds } }, include: { type: true } }),
      this.balance.defaultHolidays(),
    ]);
    const absByEmp = new Map<string, typeof absences>();
    for (const a of absences) (absByEmp.get(a.employeeId) ?? absByEmp.set(a.employeeId, []).get(a.employeeId)!).push(a);

    const seeL4 = canViewL4(user);
    // Ten eksport jest drugą — obok `GET /absences` — drogą, którą znacznik kategorii szczególnej
    // wychodzi z systemu. Deklaracja wobec zamawiającego brzmi „każdy uprawniony odczyt trafia do
    // audytu", więc akcja musi być ta sama (`VIEW_TYPES`), inaczej istniejące filtry dziennika
    // pokazywałyby tylko połowę odczytów.
    if (seeL4) {
      await this.prisma.auditLog.create({
        data: { entity: 'Report', entityId: unitId, action: 'VIEW_TYPES', userId: user.sub,
          description: 'Eksport płacowy z dniami kategorii szczególnej (L4) dla jednostki.' },
      });
    }
    const now = todayUtc();
    const records = employees.map((e) => {
      const period = resolveBillingPeriod(e.employmentType, now);
      const holidays = this.balance.holidaysOf(e, defaultHolidays);
      const inPeriod = (absByEmp.get(e.id) ?? []).filter((a) => a.dateFrom <= period.to && a.dateTo >= period.from);
      // Kubełki liczone przez atrybucję dnia, nie każdy osobno: dzień pokryty i urlopem, i L4
      // należy wyłącznie do L4, więc trafia do jednej kolumny. Sumowane osobno dałyby te same
      // dni rozliczone dwa razy — raz jako urlop, raz jako chorobowe.
      const daysOf = (pred: (t: { affectsPool: boolean; specialCategory: boolean }) => boolean) =>
        countOverlaidDays(
          inPeriod.map((a) => ({
            dateFrom: a.dateFrom, dateTo: a.dateTo,
            overrides: !a.type.affectsPool,
            counts: pred(a.type),
            fraction: dayFraction(a.dayPart, a.hourFrom ?? undefined, a.hourTo ?? undefined),
          })),
          period,
          holidays,
        );
      const rec: Record<string, unknown> = {
        employeeId: e.id, firstName: e.firstName, lastName: e.lastName, employmentType: e.employmentType,
        periodFrom: isoDate(period.from), periodTo: isoDate(period.to),
        leaveDaysUsed: daysOf((t) => t.affectsPool),
      };
      if (seeL4) rec.specialCategoryDays = daysOf((t) => t.specialCategory);
      return rec;
    }).sort((a, b) => String(a.lastName).localeCompare(String(b.lastName), 'pl'));

    return { schemaVersion: PAYROLL_SCHEMA_VERSION, generatedAt: now.toISOString(), unitId, records };
  }

  payrollSchema() {
    return {
      version: PAYROLL_SCHEMA_VERSION,
      fields: [
        { name: 'employeeId', type: 'string', desc: 'Identyfikator pracownika' },
        { name: 'firstName', type: 'string', desc: 'Imię' },
        { name: 'lastName', type: 'string', desc: 'Nazwisko' },
        { name: 'employmentType', type: 'enum(UOP|B2B|OUT)', desc: 'Forma zatrudnienia' },
        { name: 'periodFrom', type: 'date', desc: 'Początek okresu rozliczeniowego' },
        { name: 'periodTo', type: 'date', desc: 'Koniec okresu rozliczeniowego' },
        { name: 'leaveDaysUsed', type: 'number', desc: 'Wykorzystane dni urlopu (typy obniżające pulę); dni pokryte kategorią szczególną liczą się do niej, nie tutaj' },
        { name: 'specialCategoryDays', type: 'number', desc: 'Dni kategorii szczególnej (np. L4) — tylko dla uprawnionych (VIEW_L4)', conditional: 'VIEW_L4' },
      ],
    };
  }
}
