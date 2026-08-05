import { Injectable } from '@nestjs/common';
import { balance, countWorkingDays, dayFraction, isoDate, proratePool, resolveBillingPeriod, usedLeaveDays } from '@nieobecnosci/core';
import ExcelJS from 'exceljs';
import { PrismaService } from './prisma.service';
import { OrgService } from './org.service';
import { BalanceService } from './balance.service';
import type { AuthUser } from './auth/current-user.decorator';
import { canViewL4 } from './auth/rbac';

// FR-F6 — stabilny, wersjonowany schemat eksportu dla płac/PMO. Zmiany → bump wersji.
const PAYROLL_SCHEMA_VERSION = '1.0';

export interface UsageRow {
  employeeId: string;
  name: string;
  employmentType: string;
  pool: number;
  carriedOver: number;
  used: number;
  remaining: number;
}
export interface TreeNode {
  id: string;
  name: string;
  type: string;
  headcount: number;
  used: number;
  children: TreeNode[];
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly org: OrgService,
    private readonly balance: BalanceService,
  ) {}

  // FR-F2 — wykorzystanie urlopu per pracownik w jednostce (z poddrzewem).
  // Liczone wsadowo (kilka zapytań na cały zbiór), nie po jednym na osobę.
  async usage(unitId: string): Promise<{ unitId: string; rows: UsageRow[]; totals: { pool: number; used: number; remaining: number } }> {
    const memberIds = await this.org.employeeIdsInUnit(unitId);
    const [employees, allowances, absences, defaultPool] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: memberIds } }, include: { holidayCalendar: { include: { holidays: true } } } }),
      this.prisma.leaveAllowance.findMany({ where: { employeeId: { in: memberIds } } }),
      this.prisma.absence.findMany({ where: { employeeId: { in: memberIds } }, include: { type: true } }),
      this.balance.defaultPool(),
    ]);

    const allowByKey = new Map(allowances.map((a) => [`${a.employeeId}:${a.periodYear}`, a]));
    const absByEmp = new Map<string, typeof absences>();
    for (const a of absences) (absByEmp.get(a.employeeId) ?? absByEmp.set(a.employeeId, []).get(a.employeeId)!).push(a);

    const now = new Date();
    const rows: UsageRow[] = employees.map((e) => {
      const period = resolveBillingPeriod(e.employmentType, now);
      const allow = allowByKey.get(`${e.id}:${period.year}`);
      const carriedOver = allow?.carriedOver ?? 0;
      const pool = allow?.overrideDays != null
        ? allow.overrideDays
        : proratePool(allow?.baseDays ?? defaultPool, { from: period.from, to: period.to }, e.startDate, e.endDate); // FR-B9
      const holidays = new Set((e.holidayCalendar?.holidays ?? []).map((h) => isoDate(h.date)));
      const used = usedLeaveDays(
        (absByEmp.get(e.id) ?? []).map((a) => ({
          dateFrom: a.dateFrom, dateTo: a.dateTo, affectsPool: a.type.affectsPool,
          fraction: dayFraction(a.dayPart, a.hourFrom ?? undefined, a.hourTo ?? undefined),
        })),
        period,
        holidays,
      );
      return { employeeId: e.id, name: `${e.firstName} ${e.lastName}`, employmentType: e.employmentType, ...balance(pool, carriedOver, used) };
    }).sort((a, b) => a.name.localeCompare(b.name, 'pl'));

    const totals = rows.reduce(
      (t, r) => ({ pool: t.pool + r.pool, used: t.used + r.used, remaining: t.remaining + r.remaining }),
      { pool: 0, used: 0, remaining: 0 },
    );
    return { unitId, rows, totals };
  }

  // FR-F5 — „kto zalega": osoby z zaległym urlopem lub dużym niewybranym saldem.
  async overdue(unitId: string, threshold = 10) {
    const { rows } = await this.usage(unitId);
    const flagged = rows
      .filter((r) => r.carriedOver > 0 || r.remaining >= threshold)
      .map((r) => ({ ...r, zalega: r.carriedOver > 0 }))
      .sort((a, b) => b.carriedOver - a.carriedOver || b.remaining - a.remaining);
    return { unitId, threshold, rows: flagged };
  }

  // FR-F3 — drążenie hierarchii: każdy węzeł agreguje unikalnych pracowników z poddrzewa.
  async tree(unitId: string): Promise<TreeNode> {
    const [units, memberships, usage] = await Promise.all([
      this.prisma.orgUnit.findMany(),
      this.prisma.orgUnitMembership.findMany(),
      this.usage(unitId),
    ]);
    const byId = new Map(units.map((u) => [u.id, u]));
    const usedByEmp = new Map(usage.rows.map((r) => [r.employeeId, r.used]));
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
      const used = [...emp].reduce((s, e) => s + (usedByEmp.get(e) ?? 0), 0);
      return { id, name: u.name, type: u.type, headcount: emp.size, used, children: (childrenOf.get(id) ?? []).map(build) };
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
    ws.addRow({ name: 'RAZEM', pool: totals.pool, used: totals.used, remaining: totals.remaining }).font = { bold: true };
    // ponytail: cast typów (exceljs Buffer vs Node Buffer); runtime to prawdziwy Buffer.
    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  // FR-F6 — eksport pod płace/PMO o stabilnym, wersjonowanym schemacie. RODO-safe:
  // dni kategorii szczególnej (L4) dołączane wyłącznie dla uprawnionych (VIEW_L4/admin).
  async payrollExport(unitId: string, user: AuthUser) {
    const memberIds = await this.org.employeeIdsInUnit(unitId);
    const [employees, absences] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: memberIds } }, include: { holidayCalendar: { include: { holidays: true } } } }),
      this.prisma.absence.findMany({ where: { employeeId: { in: memberIds } }, include: { type: true } }),
    ]);
    const absByEmp = new Map<string, typeof absences>();
    for (const a of absences) (absByEmp.get(a.employeeId) ?? absByEmp.set(a.employeeId, []).get(a.employeeId)!).push(a);

    const seeL4 = canViewL4(user);
    const now = new Date();
    const records = employees.map((e) => {
      const period = resolveBillingPeriod(e.employmentType, now);
      const holidays = new Set((e.holidayCalendar?.holidays ?? []).map((h) => isoDate(h.date)));
      const inPeriod = (absByEmp.get(e.id) ?? []).filter((a) => a.dateFrom <= period.to && a.dateTo >= period.from);
      const daysOf = (pred: (t: { affectsPool: boolean; specialCategory: boolean }) => boolean) =>
        inPeriod.filter((a) => pred(a.type)).reduce((s, a) => {
          const from = a.dateFrom > period.from ? a.dateFrom : period.from;
          const to = a.dateTo < period.to ? a.dateTo : period.to;
          return s + countWorkingDays(from, to, holidays) * dayFraction(a.dayPart, a.hourFrom ?? undefined, a.hourTo ?? undefined);
        }, 0);
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
        { name: 'leaveDaysUsed', type: 'number', desc: 'Wykorzystane dni urlopu (typy obniżające pulę)' },
        { name: 'specialCategoryDays', type: 'number', desc: 'Dni kategorii szczególnej (np. L4) — tylko dla uprawnionych (VIEW_L4)', conditional: 'VIEW_L4' },
      ],
    };
  }
}
