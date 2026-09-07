import { Controller, Get, Query } from '@nestjs/common';
import { isoDate, todayUtc } from '@nieobecnosci/core';
import { PrismaService } from './prisma.service';
import { OrgService } from './org.service';
import { CurrentUser, type AuthUser } from './auth/current-user.decorator';

// FR-C1/C3/H1 — kalendarz zespołu (Tribe). Prezentacja JEDNOLITA: bez typu,
// bez znacznika L4 (D1/D2/H3). Ochrona L4 z konstrukcji — typ nie opuszcza serwera.
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly org: OrgService,
  ) {}

  @Get()
  async get(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // Domyślny zakres to bieżący miesiąc liczony w strefie organizacji: po lokalnej północy
    // pierwszego dnia miesiąca UTC pokazywałby jeszcze miesiąc poprzedni.
    const now = todayUtc();
    const fromD = from ? new Date(from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const toD = to ? new Date(to) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    const peers = await this.org.visiblePeers(user);
    const absences = await this.prisma.absence.findMany({
      where: { employeeId: { in: peers }, dateFrom: { lte: toD }, dateTo: { gte: fromD } },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: [{ dateFrom: 'asc' }],
    });

    return absences.map((a) => ({
      employeeId: a.employeeId,
      employee: `${a.employee.firstName} ${a.employee.lastName}`,
      dateFrom: isoDate(a.dateFrom),
      dateTo: isoDate(a.dateTo),
      dayPart: a.dayPart,
    }));
  }

  /**
   * FR-C1/C3 — siatka zespołu: skład Tribe **plus** nieobecności w zadanym oknie.
   *
   * Różnica wobec `GET /calendar` jest merytoryczna, nie techniczna: tamten zwraca wyłącznie
   * nieobecności, więc osoba bez wpisu nie istnieje w odpowiedzi. Widok osi czasu potrzebuje
   * czegoś odwrotnego — pokazuje **cały zespół**, żeby puste wiersze mówiły „ta osoba jest
   * dostępna". To informacja, po którą sięga się przy planowaniu sprintu, i nie da się jej
   * odczytać z listy samych nieobecności.
   *
   * Zakres widoczności: `visiblePeers` — członek Tribe widzi cały Tribe (FR-H1, podział na
   * squady jest w tych granicach jawny), a role ogólnofirmowe całą firmę (FR-H2). Typ
   * nieobecności nadal nie opuszcza serwera (D1/D2), więc kanał zostaje L4-safe.
   */
  @Get('team')
  async team(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('unitId') unitId?: string,
    @Query('leadersOnly') leadersOnly?: string,
  ) {
    const fromD = new Date(`${from}T00:00:00.000Z`);
    const toD = new Date(`${to}T00:00:00.000Z`);
    let peers = await this.org.visiblePeers(user);
    // Filtry dyrektora (feedback002): jedna jednostka (przecięcie z zasięgiem, nigdy poszerzenie)
    // i „tylko liderzy" — osoby wskazane jako liderzy jakiejkolwiek widocznej jednostki.
    if (unitId) {
      await this.org.assertUnitInScope(user, unitId);
      const inUnit = new Set(await this.org.employeeIdsInUnit(unitId));
      peers = peers.filter((id) => inUnit.has(id));
    }
    const ledUnits = await this.prisma.orgUnit.findMany({ where: { leaderId: { in: peers } }, select: { leaderId: true, name: true }, orderBy: { name: 'asc' } });
    const leaderOf = new Map<string, string[]>();
    for (const u of ledUnits) (leaderOf.get(u.leaderId!) ?? leaderOf.set(u.leaderId!, []).get(u.leaderId!)!).push(u.name);
    if (leadersOnly === 'true') peers = peers.filter((id) => leaderOf.has(id));

    const [employees, memberships, absences] = await Promise.all([
      this.prisma.employee.findMany({
        where: { id: { in: peers } },
        select: { id: true, firstName: true, lastName: true, isKeyRole: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.orgUnitMembership.findMany({
        where: { employeeId: { in: peers }, orgUnit: { type: 'SQUAD' } },
        select: { employeeId: true, orgUnit: { select: { id: true, name: true } } },
      }),
      this.prisma.absence.findMany({
        where: { employeeId: { in: peers }, dateFrom: { lte: toD }, dateTo: { gte: fromD } },
        select: { employeeId: true, dateFrom: true, dateTo: true, dayPart: true },
        orderBy: [{ dateFrom: 'asc' }],
      }),
    ]);

    // Jedna osoba może należeć do kilku jednostek (FR-G4). Na osi czasu ma jednak stać
    // w jednym wierszu, więc do grupowania bierzemy pierwszy squad alfabetycznie — a nie
    // powielamy jej pod każdym, bo policzona dwa razy zafałszowałaby obraz obsady.
    const squadOf = new Map<string, { id: string; name: string }>();
    for (const m of memberships.sort((a, b) => a.orgUnit.name.localeCompare(b.orgUnit.name, 'pl'))) {
      if (!squadOf.has(m.employeeId)) squadOf.set(m.employeeId, m.orgUnit);
    }

    return {
      people: employees.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        initials: `${e.firstName[0] ?? ''}${e.lastName[0] ?? ''}`.toUpperCase(),
        squad: squadOf.get(e.id)?.name ?? null,
        keyRole: e.isKeyRole,
        leaderOf: leaderOf.get(e.id) ?? [],
      })),
      absences: absences.map((a) => ({
        employeeId: a.employeeId,
        dateFrom: isoDate(a.dateFrom),
        dateTo: isoDate(a.dateTo),
        dayPart: a.dayPart,
      })),
    };
  }
}
