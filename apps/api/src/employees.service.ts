import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentType, PermissionScope, Role } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from './prisma.service';
import { CreateEmployeeDto } from './dto';
import { hashPassword } from './auth/auth.service';
import type { AuthUser } from './auth/current-user.decorator';

// Domyślne mapowanie nagłówków .xlsx → pola. Układ docelowy do potwierdzenia (FR-G5);
// można je nadpisać per import (parametr `mapping`), więc finalny format nie wymaga zmian w kodzie.
const COLS = {
  firstName: 'Imię',
  lastName: 'Nazwisko',
  email: 'E-mail',
  login: 'Login',
  employmentType: 'Forma',
  startDate: 'Data startu',
} as const;
export type EmployeeColMap = Partial<Record<keyof typeof COLS, string>>;

const EMPLOYMENT_TYPES: readonly string[] = ['UOP', 'B2B', 'OUT'];

export interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        login: dto.login,
        employmentType: dto.employmentType,
        role: dto.role,
        isKeyRole: dto.isKeyRole,
        holidayCalendarId: dto.holidayCalendarId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        passwordHash: dto.password ? hashPassword(dto.password) : null,
      },
      omit: { passwordHash: true },
    });
  }

  setPassword(id: string, password: string) {
    return this.prisma.employee.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
  }

  // FR-B8 — zmiana formy zatrudnienia w trakcie roku. Od zmiany obowiązują reguły nowej formy
  // (balans/raporty czytają bieżącą formę); dane sprzed zmiany zostają, fakt zmiany trafia do audytu.
  async changeEmploymentType(id: string, employmentType: EmploymentType, user: AuthUser) {
    const emp = await this.prisma.employee.findUnique({ where: { id } });
    if (!emp) throw new NotFoundException('Pracownik nie istnieje.');
    if (emp.employmentType === employmentType) {
      return this.prisma.employee.findUnique({ where: { id }, omit: { passwordHash: true } });
    }
    const updated = await this.prisma.employee.update({ where: { id }, data: { employmentType }, omit: { passwordHash: true } });
    await this.prisma.auditLog.create({
      data: { entity: 'Employee', entityId: id, subjectId: id, action: 'EMPLOYMENT_TYPE_CHANGE', userId: user.sub,
        description: `Zmiana formy zatrudnienia: ${emp.employmentType} → ${employmentType}.` },
    });
    return updated;
  }

  // FR-H4 — zmiana roli oraz nadawanie/odbieranie uprawnień rozszerzonych (audytowalne).
  async changeRole(id: string, role: Role, user: AuthUser) {
    const emp = await this.prisma.employee.findUnique({ where: { id } });
    if (!emp) throw new NotFoundException('Pracownik nie istnieje.');
    const updated = await this.prisma.employee.update({ where: { id }, data: { role }, omit: { passwordHash: true } });
    await this.prisma.auditLog.create({ data: { entity: 'Employee', entityId: id, subjectId: id, action: 'ROLE_CHANGE', userId: user.sub, description: `Zmiana roli: ${emp.role} → ${role}.` } });
    return updated;
  }

  async listPermissions(id: string) {
    const perms = await this.prisma.permission.findMany({ where: { employeeId: id } });
    return perms.map((p) => p.scope);
  }

  async grantPermission(id: string, scope: PermissionScope, user: AuthUser) {
    await this.prisma.permission.upsert({
      where: { employeeId_scope: { employeeId: id, scope } },
      create: { employeeId: id, scope, grantedById: user.sub },
      update: { grantedById: user.sub, grantedAt: new Date() },
    });
    await this.prisma.auditLog.create({ data: { entity: 'Permission', entityId: id, subjectId: id, action: 'PERMISSION_GRANT', userId: user.sub, description: `Nadano uprawnienie ${scope}.` } });
    return this.listPermissions(id);
  }

  async revokePermission(id: string, scope: PermissionScope, user: AuthUser) {
    await this.prisma.permission.deleteMany({ where: { employeeId: id, scope } });
    await this.prisma.auditLog.create({ data: { entity: 'Permission', entityId: id, subjectId: id, action: 'PERMISSION_REVOKE', userId: user.sub, description: `Odebrano uprawnienie ${scope}.` } });
    return this.listPermissions(id);
  }

  // FR-J2 — anonimizacja (prawo do bycia zapomnianym). Wiersz zostaje (integralność wpisów), PII usunięte.
  async anonymize(id: string, user: AuthUser) {
    const emp = await this.prisma.employee.findUnique({ where: { id } });
    if (!emp) throw new NotFoundException('Pracownik nie istnieje.');
    if (emp.login.startsWith('anon-')) return { anonymized: false };
    await this.prisma.employee.update({
      where: { id },
      data: { firstName: 'Pracownik', lastName: 'zanonimizowany', email: `anon-${id}@example.invalid`, login: `anon-${id}`, passwordHash: null },
    });
    await this.prisma.auditLog.create({ data: { entity: 'Employee', entityId: id, subjectId: id, action: 'ANONYMIZE', userId: user.sub, description: 'Anonimizacja danych osobowych (RODO).' } });
    return { anonymized: true };
  }

  // FR-G5 — import listy pracowników z .xlsx (zasilenie bez integracji z AD).
  // `mapping` nadpisuje nagłówki kolumn (gdy plik zamawiającego używa innych nazw).
  async importXlsx(buffer: Buffer, mapping?: EmployeeColMap): Promise<ImportResult> {
    const cols = { ...COLS, ...(mapping ?? {}) };
    const wb = new ExcelJS.Workbook();
    // ponytail: cast łata różnicę typów (Buffer generyczny w @types/node 22 vs typy exceljs); runtime OK.
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('Plik nie zawiera arkusza.');

    const headerIndex: Record<string, number> = {};
    ws.getRow(1).eachCell((cell, col) => {
      headerIndex[String(cell.value ?? '').trim()] = col;
    });
    const cellOf = (row: ExcelJS.Row, header: string): string => {
      const col = headerIndex[header];
      return col ? String(row.getCell(col).value ?? '').trim() : '';
    };

    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const email = cellOf(row, cols.email);
      if (!email) continue; // pusty wiersz

      const formaRaw = cellOf(row, cols.employmentType).toUpperCase();
      if (!EMPLOYMENT_TYPES.includes(formaRaw)) {
        result.errors.push({ row: r, message: `Nieznana forma zatrudnienia: "${formaRaw}"` });
        continue;
      }
      const startRaw = cellOf(row, cols.startDate);
      const startDate = startRaw ? new Date(startRaw) : null;
      if (!startDate || Number.isNaN(startDate.getTime())) {
        result.errors.push({ row: r, message: `Niepoprawna data startu: "${startRaw}"` });
        continue;
      }

      const data = {
        firstName: cellOf(row, cols.firstName),
        lastName: cellOf(row, cols.lastName),
        email,
        login: cellOf(row, cols.login) || email,
        employmentType: formaRaw as EmploymentType,
        startDate,
      };

      const existing = await this.prisma.employee.findUnique({ where: { email } });
      if (existing) {
        await this.prisma.employee.update({ where: { email }, data });
        result.updated++;
      } else {
        await this.prisma.employee.create({ data });
        result.created++;
      }
    }
    return result;
  }
}
