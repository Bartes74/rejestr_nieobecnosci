import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentType, PermissionScope, Role } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { readSheet } from './xlsx';
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

/**
 * Pola pracownika, które nigdy nie opuszczają API.
 *
 * `passwordHash` to oczywistość. `feedToken` jest mniej oczywisty, a równie wrażliwy: kanał
 * iCal (FR-F4) jest trasą publiczną, bo klienty kalendarza nie wysyłają nagłówka Bearer, więc
 * token w adresie PEŁNI ROLĘ HASŁA. Katalog pracowników oddawał go razem z resztą wiersza —
 * `omit` usuwa wyłącznie pola wskazane wprost — a katalog widzi też dyrektor, PMO i każdy
 * z uprawnieniem MODIFY_ABSENCE. Żadna z tych ról nie ma prawa czytać znacznika L4
 * (patrz `canViewL4`), a przez cudzy token kanału czytała nazwy typów wprost i bez śladu
 * w dzienniku — czyli obchodziła naraz kontrolę FR-J1 i obowiązek audytu.
 *
 * Stała jest jedna, żeby nowy endpoint zwracający pracownika nie musiał sobie o tym przypominać.
 */
export const HIDDEN_EMPLOYEE_FIELDS = { passwordHash: true, feedToken: true } as const;

export interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto) {
    try {
      return await this.prisma.employee.create({
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
        omit: HIDDEN_EMPLOYEE_FIELDS,
      });
    } catch (e) {
      // Unikalności loginu i e-maila pilnuje baza; bez tłumaczenia duplikat wychodził jako 500
      // „Internal server error", choć to błąd danych wejściowych. Treść ta sama co przy imporcie .xlsx.
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException(`Login lub e-mail już zajęty: "${dto.login}" / "${dto.email}".`);
      }
      throw e;
    }
  }

  setPassword(id: string, password: string) {
    // Kontroler i tak odrzuca wynik, ale metoda oddawała świeżo policzony hash hasła — to, że
    // nikt go dziś nie przepuszcza dalej, jest przypadkiem, nie zabezpieczeniem.
    //
    // `sessionsValidFrom` kończy sesje już trwające. Administrator resetuje cudze hasło przede
    // wszystkim wtedy, gdy podejrzewa przejęcie konta — zostawienie działających sesji mijałoby
    // się wtedy z celem resetu. Przy zwykłym „zapomniałem hasła" cena to wylogowanie
    // z pozostałych kart, czyli zachowanie i tak spotykane w większości systemów.
    return this.prisma.employee.update({
      where: { id },
      data: { passwordHash: hashPassword(password), sessionsValidFrom: new Date() },
      omit: HIDDEN_EMPLOYEE_FIELDS,
    });
  }

  // FR-B8 — zmiana formy zatrudnienia w trakcie roku. Od zmiany obowiązują reguły nowej formy
  // (balans/raporty czytają bieżącą formę); dane sprzed zmiany zostają, fakt zmiany trafia do audytu.
  async changeEmploymentType(id: string, employmentType: EmploymentType, user: AuthUser) {
    const emp = await this.prisma.employee.findUnique({ where: { id } });
    if (!emp) throw new NotFoundException('Pracownik nie istnieje.');
    if (emp.employmentType === employmentType) {
      return this.prisma.employee.findUnique({ where: { id }, omit: HIDDEN_EMPLOYEE_FIELDS });
    }
    const updated = await this.prisma.employee.update({ where: { id }, data: { employmentType }, omit: HIDDEN_EMPLOYEE_FIELDS });
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
    const updated = await this.prisma.employee.update({ where: { id }, data: { role }, omit: HIDDEN_EMPLOYEE_FIELDS });
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
      // `feedToken` też, i to nie dla porządku: kanał iCal jest trasą publiczną uwierzytelnianą
      // samym tokenem w adresie, więc token, który przeżywał anonimizację, dalej oddawał pełną
      // historię nieobecności wraz z typami. Prawo do bycia zapomnianym nie obejmowało wtedy
      // jedynej drogi, którą te dane wychodziły bez logowania.
      //
      // `sessionsValidFrom` kończy sesje trwające w chwili anonimizacji. Wiersz pracownika
      // zostaje, bo wiszą na nim wpisy nieobecności — a skoro zostaje, to strażnik go znajduje
      // i bez tego znacznika wpuszczałby dalej. Zalogować się ponownie i tak nie sposób (brak
      // hasła), ale token wydany wcześniej działał do wygaśnięcia, czyli nawet pół doby po
      // realizacji prawa do bycia zapomnianym.
      data: { firstName: 'Pracownik', lastName: 'zanonimizowany', email: `anon-${id}@example.invalid`, login: `anon-${id}`, passwordHash: null, feedToken: null, sessionsValidFrom: new Date() },
    });
    await this.prisma.auditLog.create({ data: { entity: 'Employee', entityId: id, subjectId: id, action: 'ANONYMIZE', userId: user.sub, description: 'Anonimizacja danych osobowych (RODO).' } });
    return { anonymized: true };
  }

  // FR-G5 — import listy pracowników z .xlsx (zasilenie bez integracji z AD).
  // `mapping` nadpisuje nagłówki kolumn (gdy plik zamawiającego używa innych nazw).
  async importXlsx(buffer: Buffer, mapping?: EmployeeColMap): Promise<ImportResult> {
    const cols = { ...COLS, ...(mapping ?? {}) };
    const { ws, cell: cellOf } = await readSheet(buffer);

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

      // Zapis w try/catch, bo plik zamawiającego bywa niespójny w sposób, którego walidacja
      // wiersza nie wychwyci: dwa wiersze z tym samym loginem łamią unikalność dopiero w bazie.
      // Bez tego pierwszy taki wiersz kończył cały import błędem 500 — z częścią osób już
      // zapisaną i bez informacji, na czym się przerwało. Struktura `errors` istniała, ale
      // obejmowała wyłącznie walidację, więc raport milczał o jedynym realnym problemie.
      try {
        const existing = await this.prisma.employee.findUnique({ where: { email } });
        if (existing) {
          await this.prisma.employee.update({ where: { email }, data });
          result.updated++;
        } else {
          await this.prisma.employee.create({ data });
          result.created++;
        }
      } catch (e) {
        const msg = (e as { code?: string }).code === 'P2002'
          ? `Login lub e-mail już zajęty: "${data.login}" / "${email}"`
          : `Nie udało się zapisać wiersza: ${(e as Error).message}`;
        result.errors.push({ row: r, message: msg });
      }
    }
    return result;
  }
}
