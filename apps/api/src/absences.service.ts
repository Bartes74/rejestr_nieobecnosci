import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { countWorkingDays, dayFraction, isoDate, resolveBillingPeriod, usedLeaveDays } from '@nieobecnosci/core';
import type { DayPart } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { BalanceService } from './balance.service';
import { OrgService } from './org.service';
import { NotificationsService } from './notifications.service';
import { BulkCreateAbsenceDto, CreateAbsenceDto, UpdateAbsenceDto } from './dto';
import type { AuthUser } from './auth/current-user.decorator';
import { canModifyOthers, canViewL4 } from './auth/rbac';

const fractionOf = (a: { dayPart: DayPart; hourFrom: string | null; hourTo: string | null }) =>
  dayFraction(a.dayPart, a.hourFrom ?? undefined, a.hourTo ?? undefined);

@Injectable()
export class AbsencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly org: OrgService,
    private readonly notifications: NotificationsService,
  ) {}

  // FR-I2 — własna historia (z typami). Cudze typy (w tym L4) tylko dla uprawnionych — z audytem (FR-J1).
  // FR-A5 — lider widzi wpisy swojego Tribe, ale BEZ typu (L4 niewyróżniane, D2/H3) — by móc je korygować.
  // Dni robocze liczy serwer (kalendarz świąt osoby), żeby lista pokazywała tę samą liczbę,
  // którą zobaczył balans — klient nie zna świąt i wcześniej zawyżał wynik.
  private async withWorkingDays<T extends { dateFrom: Date; dateTo: Date; dayPart: DayPart; hourFrom: string | null; hourTo: string | null }>(
    employeeId: string,
    rows: T[],
  ): Promise<(T & { workingDays: number })[]> {
    const holidays = await this.balance.holidaysFor(employeeId);
    return rows.map((a) => ({ ...a, workingDays: countWorkingDays(a.dateFrom, a.dateTo, holidays) * fractionOf(a) }));
  }

  async listForEmployee(employeeId: string, user: AuthUser) {
    if (employeeId === user.sub) {
      const own = await this.prisma.absence.findMany({ where: { employeeId }, include: { type: true }, orderBy: { dateFrom: 'desc' } });
      return this.withWorkingDays(employeeId, own);
    }
    const privileged = canViewL4(user); // admin / VIEW_L4 — widzi typy (z audytem)
    const leaderPeer = user.role === 'LEADER' && (await this.org.tribePeers(user.sub)).includes(employeeId);
    if (!privileged && !leaderPeer && !canModifyOthers(user)) {
      throw new ForbiddenException('Brak dostępu do nieobecności tej osoby.');
    }
    const rows = await this.prisma.absence.findMany({ where: { employeeId }, include: { type: true }, orderBy: { dateFrom: 'desc' } });
    if (privileged) {
      await this.prisma.auditLog.create({
        data: { entity: 'Absence', entityId: employeeId, action: 'VIEW_TYPES', userId: user.sub,
          description: 'Odczyt typów nieobecności (w tym znacznika L4) innego pracownika.' },
      });
      return this.withWorkingDays(employeeId, rows);
    }
    // Lider/MODIFY bez VIEW_L4 — typ zamaskowany; id typu NIE wychodzi na zewnątrz (inaczej dałoby się odgadnąć L4).
    const masked = rows.map((a) => ({
      ...a, typeId: null,
      type: { id: null, name: 'Nieobecność', affectsPool: false, affectsCapacity: false, specialCategory: false },
    }));
    return this.withWorkingDays(employeeId, masked);
  }

  async create(dto: CreateAbsenceDto, user: AuthUser) {
    await this.assertCanActFor(dto.employeeId, user);
    const from = new Date(dto.dateFrom);
    const to = new Date(dto.dateTo);
    const dayPart = dto.dayPart ?? 'FULL';
    await this.validate(dto.employeeId, dto.typeId, from, to, dayPart, dto.hourFrom ?? null, dto.hourTo ?? null, null);
    const created = await this.prisma.absence.create({
      data: {
        employeeId: dto.employeeId,
        typeId: dto.typeId,
        dateFrom: from,
        dateTo: to,
        dayPart,
        hourFrom: dto.hourFrom ?? null,
        hourTo: dto.hourTo ?? null,
        source: dto.employeeId === user.sub ? 'SELF' : 'DELEGATE',
        createdById: user.sub,
      },
    });
    await this.audit('ABSENCE_CREATE', created.id, created.employeeId, user, `Dodano ${isoDate(created.dateFrom)}–${isoDate(created.dateTo)}.`);
    // FR-E1 — informacja do lidera o nieobecności B2B/OUT (best-effort).
    await this.notifications.notifyLeadersOfAbsence(created.employeeId, created.dateFrom, created.dateTo).catch(() => {});
    return created;
  }

  // FR-A10 — operacje masowe: jedna nieobecność dla wielu pracowników. Reużywa `create` per osoba
  // (pełne RBAC/walidacja/audyt/powiadomienia), zbiera błędy per pracownik — bez transakcji (częściowy
  // sukces jak w imporcie: przekroczenie puli jednej osoby nie cofa pozostałych).
  async createBulk(dto: BulkCreateAbsenceDto, user: AuthUser) {
    const result = { created: 0, errors: [] as { employeeId: string; message: string }[] };
    for (const employeeId of dto.employeeIds) {
      try {
        await this.create({ employeeId, typeId: dto.typeId, dateFrom: dto.dateFrom, dateTo: dto.dateTo, dayPart: dto.dayPart, hourFrom: dto.hourFrom, hourTo: dto.hourTo }, user);
        result.created++;
      } catch (e) {
        result.errors.push({ employeeId, message: (e as Error).message });
      }
    }
    return result;
  }

  async update(id: string, dto: UpdateAbsenceDto, user: AuthUser) {
    const existing = await this.prisma.absence.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Wpis nie istnieje.');
    await this.assertCanActFor(existing.employeeId, user);
    const from = dto.dateFrom ? new Date(dto.dateFrom) : existing.dateFrom;
    const to = dto.dateTo ? new Date(dto.dateTo) : existing.dateTo;
    const typeId = dto.typeId ?? existing.typeId;
    const dayPart = dto.dayPart ?? existing.dayPart;
    await this.validate(existing.employeeId, typeId, from, to, dayPart, existing.hourFrom, existing.hourTo, id);
    const updated = await this.prisma.absence.update({
      where: { id },
      data: { typeId, dateFrom: from, dateTo: to, dayPart },
    });
    await this.audit('ABSENCE_UPDATE', updated.id, existing.employeeId, user, `Zmieniono na ${isoDate(updated.dateFrom)}–${isoDate(updated.dateTo)}.`);
    return updated;
  }

  async remove(id: string, user: AuthUser) {
    const existing = await this.prisma.absence.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Wpis nie istnieje.');
    await this.assertCanActFor(existing.employeeId, user);
    await this.prisma.absence.delete({ where: { id } });
    await this.audit('ABSENCE_DELETE', existing.id, existing.employeeId, user, `Usunięto ${isoDate(existing.dateFrom)}–${isoDate(existing.dateTo)}.`);
    return { ok: true };
  }

  // FR-A2/A3 — podgląd liczby dni roboczych (z uwzględnieniem niepełnego dnia) przed zapisem.
  async preview(employeeId: string, fromStr: string, toStr: string, user: AuthUser, dayPart: DayPart = 'FULL', hourFrom?: string, hourTo?: string) {
    await this.assertCanActFor(employeeId, user);
    const from = new Date(fromStr);
    const to = new Date(toStr);
    const holidays = await this.balance.holidaysFor(employeeId);
    const fraction = dayFraction(dayPart, hourFrom, hourTo);
    const workingDays = to < from ? 0 : countWorkingDays(from, to, holidays) * fraction;
    const current = await this.balance.current(employeeId);
    // FR-A9 — kolizja z istniejącym wpisem widoczna przed zapisem.
    const overlap = to < from ? null : await this.prisma.absence.findFirst({
      where: { employeeId, dateFrom: { lte: to }, dateTo: { gte: from } },
    });
    return {
      workingDays,
      remaining: current.remaining,
      remainingAfter: current.remaining - workingDays,
      minimumToLeave: current.minimumToLeave,
      collision: !!overlap,
      collisionFrom: overlap ? isoDate(overlap.dateFrom) : null,
      collisionTo: overlap ? isoDate(overlap.dateTo) : null,
    };
  }

  // FR-B10 — konwersja zaplanowanej nieobecności na L4 (osoba uprawniona, FR-H4).
  // L4 nie obciąża puli, więc dzień automatycznie wraca do salda UoP.
  async convertToL4(id: string, user: AuthUser) {
    if (!canModifyOthers(user)) throw new ForbiddenException('Tylko osoba uprawniona może oznaczyć wpis jako L4.');
    const existing = await this.prisma.absence.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Wpis nie istnieje.');
    const l4 = await this.prisma.absenceType.findFirst({ where: { specialCategory: true, affectsPool: false, active: true } });
    if (!l4) throw new BadRequestException('Brak zdefiniowanego typu L4.');
    const updated = await this.prisma.absence.update({ where: { id }, data: { typeId: l4.id } });
    await this.prisma.auditLog.create({
      data: { entity: 'Absence', entityId: existing.employeeId, action: 'ABSENCE_TO_L4', userId: user.sub,
        description: `Konwersja nieobecności na L4 (zwrot dnia do puli).` },
    });
    return updated;
  }

  // Wpis własny; admin/uprawnienie rozszerzone (FR-H4); lider w obrębie swojego Tribe (FR-A5).
  private async assertCanActFor(employeeId: string, user: AuthUser): Promise<void> {
    if (employeeId === user.sub || canModifyOthers(user)) return;
    if (user.role === 'LEADER' && (await this.org.tribePeers(user.sub)).includes(employeeId)) return;
    throw new ForbiddenException('Możesz zarządzać tylko własnymi nieobecnościami.');
  }

  // FR-I1 — każda operacja na wpisie zapisana w niezmiennym dzienniku (kto/kiedy/co), per wpis.
  private audit(action: string, absenceId: string, employeeId: string, user: AuthUser, desc: string) {
    const delegated = employeeId !== user.sub ? ' (w imieniu innego pracownika)' : '';
    return this.prisma.auditLog.create({
      data: { entity: 'Absence', entityId: absenceId, action, userId: user.sub, description: desc + delegated },
    });
  }

  // FR-A7 — walidacja: zakres dat, kolizja z innym wpisem osoby, przekroczenie puli (z ułamkiem dnia).
  private async validate(
    employeeId: string, typeId: string, from: Date, to: Date,
    dayPart: DayPart, hourFrom: string | null, hourTo: string | null, excludeId: string | null,
  ) {
    if (to < from) throw new BadRequestException('Data „do" jest wcześniejsza niż „od".');
    if (dayPart !== 'FULL' && from.getTime() !== to.getTime()) {
      throw new BadRequestException('Niepełny dzień (AM/PM/godziny) dotyczy pojedynczej daty.');
    }

    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) throw new NotFoundException('Pracownik nie istnieje.');
    // FR-B9 — sygnalizacja nieobecności zaplanowanej po dacie zakończenia zatrudnienia.
    if (emp.endDate && from > emp.endDate) {
      throw new BadRequestException('Nieobecność zaplanowana po dacie zakończenia zatrudnienia/współpracy.');
    }

    const type = await this.prisma.absenceType.findUnique({ where: { id: typeId } });
    if (!type) throw new BadRequestException('Nieznany typ nieobecności.');

    const overlap = await this.prisma.absence.findFirst({
      where: { employeeId, id: excludeId ? { not: excludeId } : undefined, dateFrom: { lte: to }, dateTo: { gte: from } },
    });
    if (overlap) throw new ConflictException('Kolizja z istniejącym wpisem w tym terminie.');

    if (!type.affectsPool) return; // L4 i inne niepomniejszające puli — bez kontroli limitu

    const period = resolveBillingPeriod(emp.employmentType, from);
    const { pool, carriedOver } = await this.balance.effectivePool(emp, period);
    const holidays = await this.balance.holidaysFor(employeeId);

    const others = await this.prisma.absence.findMany({
      where: { employeeId, id: excludeId ? { not: excludeId } : undefined, dateFrom: { lte: period.to }, dateTo: { gte: period.from } },
      include: { type: true },
    });
    const usedExisting = usedLeaveDays(
      others.map((a) => ({ dateFrom: a.dateFrom, dateTo: a.dateTo, affectsPool: a.type.affectsPool, fraction: fractionOf(a) })),
      period,
      holidays,
    );
    const newDays = countWorkingDays(
      from < period.from ? period.from : from,
      to > period.to ? period.to : to,
      holidays,
    ) * dayFraction(dayPart, hourFrom ?? undefined, hourTo ?? undefined);
    const available = pool + carriedOver - usedExisting;
    if (newDays > available) {
      throw new BadRequestException(`Przekroczenie puli: dostępne ${available} dni, wnioskowane ${newDays}.`);
    }
  }
}
