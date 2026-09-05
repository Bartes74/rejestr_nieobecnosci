import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { consumesPool, countOverlaidDays, countWorkingDays, dayFraction, isoDate, resolveBillingPeriod, subtractRanges } from '@nieobecnosci/core';
import { isoRange } from './serialize';
import type { DaySpan, EmploymentType } from '@nieobecnosci/core';
import type { DayPart, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { BalanceService } from './balance.service';
import { OrgService } from './org.service';
import { NotificationsService } from './notifications.service';
import { BulkCreateAbsenceDto, CreateAbsenceDto, UpdateAbsenceDto } from './dto';
import type { AuthUser } from './auth/current-user.decorator';
import { canModifyOthers, canViewL4 } from './auth/rbac';

const fractionOf = (a: { dayPart: DayPart; hourFrom: string | null; hourTo: string | null }) =>
  dayFraction(a.dayPart, a.hourFrom ?? undefined, a.hourTo ?? undefined);

type AbsenceWithType = Prisma.AbsenceGetPayload<{ include: { type: true } }>;

/**
 * Wpis chorobowy — przejmuje dzień na własność, i w liczeniu, i w tym, co widać.
 *
 * Rozpoznawany po fladze `affectsPool` typu, nie po nazwie (D1: typ wpływa na algorytm, nigdy
 * przez nazwę), więc obejmie każdy przyszły typ bez puli dodany przez administratora. Świadomie
 * po SUROWEJ fladze typu, nie po `consumesPool`: poza UoP L4 też obciąża pulę, ale nadal jest
 * wpisem innego rodzaju i nadal ma przechodzić bez kolizji.
 */
const overrides = (a: { type: { affectsPool: boolean } }) => !a.type.affectsPool;

/**
 * Koliduje wyłącznie zaplanowana nieobecność z zaplanowaną nieobecnością. Wpis chorobowy nie
 * blokuje się nigdy i niczego nie blokuje: choroby nie da się przełożyć, więc blokowanie jej
 * dlatego, że w kalendarzu coś już stoi, kazałoby wybierać między prawdą a zapisem.
 *
 * Dwa wpisy chorobowe na ten sam dzień też przechodzą — dzień i tak liczy się raz, więc pula
 * i statystyki wychodzą poprawnie. Cena jest świadoma: duplikat tego samego zwolnienia nikogo
 * nie ostrzeże, a suma dni pokazana w historii może przez to przekroczyć liczbę dni kalendarzowych.
 */
const collidesWith = (overlaps: readonly AbsenceWithType[], incoming: { affectsPool: boolean }) =>
  incoming.affectsPool && overlaps.some((o) => o.type.affectsPool);

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
  //
  // Dni pokryte wpisem chorobowym odejmują się od wpisu zaplanowanego: nieobecność 5-dniowa,
  // na którą weszło L4 obejmujące 3 z tych dni, pokazuje się jako 2 dni. Rekord w bazie zostaje
  // pięciodniowy — projekcja dotyczy wyłącznie tego, co widać — więc dalej da się go edytować
  // i usunąć, a skasowanie L4 samo przywraca pełny wymiar. Suma po wszystkich wpisach zgadza
  // się wtedy z liczbą dni kalendarzowych: 2 + 8 = 10, nie 5 + 8 = 13.
  private async withWorkingDays<T extends { dateFrom: Date; dateTo: Date; dayPart: DayPart; hourFrom: string | null; hourTo: string | null; type: { affectsPool: boolean } }>(
    employeeId: string,
    rows: T[],
  ): Promise<(Omit<T, 'dateFrom' | 'dateTo'> & { dateFrom: string; dateTo: string; workingDays: number; coveredBySick: boolean })[]> {
    const holidays = await this.balance.holidaysFor(employeeId);
    // Przykrywa wyłącznie wpis całodniowy — to samo kryterium, którym `countOverlaidDays` oddaje
    // dzień wpisowi chorobowemu (`fraction === 1`). `subtractRanges` widzi daty, nie ułamki, więc
    // bez tego filtra dwugodzinne L4 zerowało w historii cały dzień urlopu, a balans liczył go
    // dalej jako wykorzystany: wiersze sumowały się do 11, licznik pokazywał 12.
    const sick = rows.filter((a) => overrides(a) && fractionOf(a) === 1).map((a) => ({ dateFrom: a.dateFrom, dateTo: a.dateTo }));
    return rows.map((a) => {
      const visible = overrides(a) ? [{ dateFrom: a.dateFrom, dateTo: a.dateTo }] : subtractRanges(a, sick);
      const workingDays = visible.reduce((sum, r) => sum + countWorkingDays(r.dateFrom, r.dateTo, holidays), 0) * fractionOf(a);
      // Wiersz z liczbą mniejszą niż jego własny zakres mówi wprost, dlaczego: „0" bez słowa czytało
      // się jak błąd wyliczenia (uwaga zleceniodawcy), a nie jak reguła FR-B5.
      const coveredBySick = workingDays < countWorkingDays(a.dateFrom, a.dateTo, holidays) * fractionOf(a);
      return { ...isoRange(a), workingDays, coveredBySick };
    });
  }

  async listForEmployee(employeeId: string, user: AuthUser) {
    // Bez parametru Prisma dostałaby `employeeId: undefined`, czyli warunek bez filtra: admin
    // wyciągnąłby jednym żądaniem wszystkie nieobecności wszystkich osób razem z typami,
    // a wpis audytu wskazywałby pustą encję. Brak parametru to błąd wywołania, nie zapytanie.
    if (!employeeId) throw new BadRequestException('Podaj employeeId.');
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
        data: { entity: 'Absence', entityId: employeeId, subjectId: employeeId, action: 'VIEW_TYPES', userId: user.sub,
          description: 'Odczyt typów nieobecności (w tym znacznika L4) innego pracownika.' },
      });
      return this.withWorkingDays(employeeId, rows);
    }
    // Lider/MODIFY bez VIEW_L4 — typ zamaskowany; id typu NIE wychodzi na zewnątrz (inaczej dałoby się odgadnąć L4).
    // Projekcja liczy się PRZED maskowaniem — po nim wszystkie wpisy wyglądają tak samo, więc nie
    // dałoby się już powiedzieć, który przejmuje dzień, i suma wyszłaby zawyżona (13 zamiast 10).
    const counted = await this.withWorkingDays(employeeId, rows);
    // `coveredBySick` też zamaskowane: flaga na jednym z dwóch nakładających się wpisów wskazywałaby
    // palcem, który z nich jest L4.
    return counted.map((a) => ({
      ...a, typeId: null, coveredBySick: false,
      type: { id: null, name: 'Nieobecność', affectsPool: false, affectsCapacity: false, specialCategory: false },
    }));
  }

  /**
   * Szereguje operacje dotyczące jednej osoby.
   *
   * Między sprawdzeniem puli a zapisem nie było niczego, co powstrzymałoby drugie żądanie:
   * dwa równoległe zapisy czytały ten sam stan, oba przechodziły walidację i oba lądowały
   * w bazie — pula wychodziła przekroczona, a kolizja terminów podwójna. Wystarczyły dwie
   * karty przeglądarki albo operacja masowa.
   *
   * Kolejkujemy wyłącznie per osoba, więc zapisy różnych osób dalej idą równolegle.
   *
   * ponytail: kolejka w procesie — API działa w jednej instancji (docker-compose.prod.yml).
   * Przy skalowaniu poziomym zastąpić blokadą wiersza: $transaction + SELECT … FOR UPDATE.
   */
  private readonly queues = new Map<string, Promise<unknown>>();

  private serialize<T>(employeeId: string, fn: () => Promise<T>): Promise<T> {
    // Poprzednik przez `.then` bez `catch` w łańcuchu zwracanym na zewnątrz: błąd jednego
    // żądania nie może przewrócić następnego w kolejce ani zostawić odrzuconej obietnicy
    // bez odbiorcy (w Node kończy się to zabiciem procesu).
    const prev = this.queues.get(employeeId) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    const settled = next.then(() => {}, () => {});
    this.queues.set(employeeId, settled);
    // Sprzątanie, żeby mapa nie rosła z każdą osobą, która kiedykolwiek coś zapisała.
    void settled.then(() => { if (this.queues.get(employeeId) === settled) this.queues.delete(employeeId); });
    return next;
  }

  create(dto: CreateAbsenceDto, user: AuthUser) {
    return this.serialize(dto.employeeId, () => this.createNow(dto, user));
  }

  private async createNow(dto: CreateAbsenceDto, user: AuthUser) {
    await this.assertCanActFor(dto.employeeId, user);
    const from = new Date(dto.dateFrom);
    const to = new Date(dto.dateTo);
    const dayPart = dto.dayPart ?? 'FULL';
    await this.validate(dto.employeeId, dto.typeId, from, to, dayPart, dto.hourFrom ?? null, dto.hourTo ?? null, null);
    // Wpis chorobowy przykrywa zaplanowany, ale go nie zmienia — nie ma czego wycinać ani czego
    // cofać, więc zapis jest pojedynczy i nie potrzebuje transakcji.
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
    return isoRange(created);
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
    // Kolejkujemy po WŁAŚCICIELU wpisu, nie po działającym — pulę przekracza się osobie,
    // której wpis dotyczy, a edytować może ją ktoś inny (lider, uprawnienie rozszerzone).
    return this.serialize(existing.employeeId, () => this.updateNow(id, dto, user, existing));
  }

  private async updateNow(id: string, dto: UpdateAbsenceDto, user: AuthUser, existing: { employeeId: string; dateFrom: Date; dateTo: Date; typeId: string; dayPart: DayPart; hourFrom: string | null; hourTo: string | null }) {
    await this.assertCanActFor(existing.employeeId, user);
    const from = dto.dateFrom ? new Date(dto.dateFrom) : existing.dateFrom;
    const to = dto.dateTo ? new Date(dto.dateTo) : existing.dateTo;
    const typeId = dto.typeId ?? existing.typeId;
    const dayPart = dto.dayPart ?? existing.dayPart;
    // Jedna reguła: godziny istnieją wyłącznie dla wpisu godzinowego. Wcześniej walidacja
    // dostawała godziny z rekordu, a zapis nie brał ich w ogóle — więc przestawienie wpisu
    // całodniowego na HOURS zostawiało godziny puste (wpis o zerowym koszcie puli), a poprawka
    // samych godzin nie robiła nic i wracała jako sukces.
    const hourFrom = dayPart === 'HOURS' ? (dto.hourFrom ?? existing.hourFrom) : null;
    const hourTo = dayPart === 'HOURS' ? (dto.hourTo ?? existing.hourTo) : null;
    await this.validate(existing.employeeId, typeId, from, to, dayPart, hourFrom, hourTo, id);
    const updated = await this.prisma.absence.update({
      where: { id },
      data: { typeId, dateFrom: from, dateTo: to, dayPart, hourFrom, hourTo },
    });
    await this.audit('ABSENCE_UPDATE', updated.id, existing.employeeId, user, `Zmieniono na ${isoDate(updated.dateFrom)}–${isoDate(updated.dateTo)}.`);
    return isoRange(updated);
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
  // `typeId` jest opcjonalne dla zgodności starszych wywołań, ale bez niego podgląd nie wie,
  // czy wpis obciąża pulę ani czy przykrywa wcześniejsze — a od tego zależy saldo po zapisie.
  async preview(employeeId: string, fromStr: string, toStr: string, user: AuthUser, dayPart: DayPart = 'FULL', hourFrom?: string, hourTo?: string, typeId?: string) {
    await this.assertCanActFor(employeeId, user);
    const from = new Date(fromStr);
    const to = new Date(toStr);
    const holidays = await this.balance.holidaysFor(employeeId);
    const fraction = dayFraction(dayPart, hourFrom, hourTo);
    const workingDays = to < from ? 0 : countWorkingDays(from, to, holidays) * fraction;
    const current = await this.balance.current(employeeId);
    const type = typeId ? await this.prisma.absenceType.findUnique({ where: { id: typeId } }) : null;
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { employmentType: true } });
    if (!emp) throw new NotFoundException('Pracownik nie istnieje.');

    // FR-A9 — kolizja widoczna przed zapisem, tą samą regułą co przy zapisie, żeby podgląd nie
    // blokował czegoś, co `create` przyjmie.
    const overlaps = to < from ? [] : await this.prisma.absence.findMany({
      where: { employeeId, dateFrom: { lte: to }, dateTo: { gte: from } },
      include: { type: true },
    });
    const overlap = !type || type.affectsPool ? overlaps.find((o) => o.type.affectsPool) ?? null : null;

    // Saldo po zapisie liczone od nowa, z hipotetycznym wpisem w zestawie — nie odejmowaniem
    // dni „na boku". Przy nakładaniu tylko pełne przeliczenie wie, które dni przechodzą na nowy
    // wpis, a które i tak już były zajęte.
    const period = resolveBillingPeriod(emp.employmentType, from);
    const usedNow = await this.usedInPeriod(employeeId, emp.employmentType, period, holidays, null);
    // Bez `typeId` (starsze wywołania) zakładamy wpis obciążający pulę i nieprzykrywający —
    // najostrożniejszy wariant: podgląd pokaże spadek salda, a nie obietnicę, że nic nie kosztuje.
    const usedAfter = to >= from
      ? await this.usedInPeriod(employeeId, emp.employmentType, period, holidays, null, {
        dateFrom: from, dateTo: to,
        overrides: type ? !type.affectsPool : false,
        counts: type ? consumesPool(emp.employmentType, type.affectsPool) : true,
        fraction,
      })
      : usedNow;
    // Zwrot to FAKTYCZNY zysk na saldzie, nie sama część wspólna: poza UoP dzień przejęty przez
    // L4 dalej obciąża pulę, tyle że jako inny rodzaj, więc nic nie wraca i wychodzi zero.
    const returnedDays = Math.max(0, usedNow - usedAfter);

    return {
      workingDays,
      remaining: current.remaining,
      remainingAfter: current.remaining + usedNow - usedAfter,
      minimumToLeave: current.minimumToLeave,
      collision: !!overlap,
      collisionFrom: overlap ? isoDate(overlap.dateFrom) : null,
      collisionTo: overlap ? isoDate(overlap.dateTo) : null,
      returnedDays,
    };
  }

  // FR-B10 — konwersja zaplanowanej nieobecności na L4 (osoba uprawniona, FR-H4).
  // Na UoP dzień wraca do puli; poza UoP zmienia się sam rodzaj nieobecności, saldo zostaje.
  async convertToL4(id: string, user: AuthUser) {
    const existing = await this.prisma.absence.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Wpis nie istnieje.');
    // Oznaczenie L4 stwierdza fakt o zdrowiu, więc nie robi tego sam zainteresowany — nawet
    // jeśli wpis jest jego własny i normalnie może go edytować.
    if (existing.employeeId === user.sub) {
      throw new ForbiddenException('Oznaczenie L4 należy do osoby uprawnionej, nie do samego zainteresowanego.');
    }
    // Poza tym obowiązuje zwykły zasięg działania. Wcześniej warunkiem było samo
    // `canModifyOthers`, przez co lider nie mógł skonwertować wpisu w swoim Tribe, choć wolno
    // mu go edytować i usunąć, a posiadacz MODIFY_ABSENCE konwertował wpis dowolnej osoby
    // w firmie — także spoza swojego zasięgu.
    await this.assertCanActFor(existing.employeeId, user);
    // Kolejność jak wszędzie indziej: to, co administrator ustawił, potem alfabet. Bez tego
    // przy dwóch typach spełniających warunek wynik zależał od kolejności wierszy w bazie.
    const l4 = await this.prisma.absenceType.findFirst({
      where: { specialCategory: true, affectsPool: false, active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    if (!l4) throw new BadRequestException('Brak zdefiniowanego typu L4.');
    const updated = await this.prisma.absence.update({ where: { id }, data: { typeId: l4.id } });
    await this.prisma.auditLog.create({
      data: { entity: 'Absence', entityId: existing.employeeId, subjectId: existing.employeeId, action: 'ABSENCE_TO_L4', userId: user.sub,
        description: `Konwersja nieobecności na L4 (zmiana rodzaju; na UoP dzień wraca do puli).` },
    });
    return isoRange(updated);
  }

  /**
   * Dni wykorzystane z puli w okresie, liczone po dniach kalendarzowych (patrz `countOverlaidDays`).
   * `extra` pozwala doliczyć wpis, którego jeszcze nie ma w bazie — podgląd potrzebuje salda „po
   * zapisie", a przy nakładaniu nie da się go dostać przez proste odjęcie.
   */
  private async usedInPeriod(
    employeeId: string,
    employmentType: EmploymentType,
    period: { from: Date; to: Date },
    holidays: ReadonlySet<string>,
    excludeId: string | null,
    extra?: DaySpan,
  ): Promise<number> {
    const rows = await this.prisma.absence.findMany({
      where: { employeeId, id: excludeId ? { not: excludeId } : undefined, dateFrom: { lte: period.to }, dateTo: { gte: period.from } },
      include: { type: true },
    });
    const spans: DaySpan[] = rows.map((a) => ({
      dateFrom: a.dateFrom, dateTo: a.dateTo,
      overrides: overrides(a),
      counts: consumesPool(employmentType, a.type.affectsPool),
      fraction: fractionOf(a),
    }));
    if (extra) spans.push(extra);
    return countOverlaidDays(spans, period, holidays);
  }

  // Wpis własny; admin/uprawnienie rozszerzone (FR-H4); lider w obrębie swojego Tribe (FR-A5).
  private async assertCanActFor(employeeId: string, user: AuthUser): Promise<void> {
    if (employeeId === user.sub || canModifyOthers(user)) return;
    if (user.role === 'LEADER' && (await this.org.tribePeers(user.sub)).includes(employeeId)) return;
    throw new ForbiddenException('Możesz zarządzać tylko własnymi nieobecnościami.');
  }

  // FR-I1 — każda operacja na wpisie zapisana w niezmiennym dzienniku (kto/kiedy/co), per wpis.
  private audit(action: string, absenceId: string, employeeId: string, user: AuthUser, desc: string) {
    // Dziennik trzyma identyfikatory, nie nazwiska: nazwisko wpisane tutaj przeżyłoby anonimizację
    // (FR-J2), a więc i żądanie usunięcia danych. Kto i kogo dotyczy, rozwija odczyt — patrz
    // AuditController.
    const delegated = employeeId !== user.sub ? ' (w imieniu innego pracownika)' : '';
    return this.prisma.auditLog.create({
      data: { entity: 'Absence', entityId: absenceId, subjectId: employeeId, action, userId: user.sub, description: desc + delegated },
    });
  }

  // FR-A7 — walidacja: zakres dat, kolizja z innym wpisem osoby, przekroczenie puli (z ułamkiem dnia).
  private async validate(
    employeeId: string, typeId: string, from: Date, to: Date,
    dayPart: DayPart, hourFrom: string | null, hourTo: string | null, excludeId: string | null,
  ): Promise<void> {
    if (to < from) throw new BadRequestException('Data „do" jest wcześniejsza niż „od".');
    if (dayPart !== 'FULL' && from.getTime() !== to.getTime()) {
      throw new BadRequestException('Niepełny dzień (AM/PM/godziny) dotyczy pojedynczej daty.');
    }
    // Wpis godzinowy bez sensownego zakresu godzin daje ułamek dnia równy zeru — czyli
    // nieobecność widoczną w kalendarzu, która nie zabiera nic z puli. Formularz pilnował tego
    // po swojej stronie (`badHours` w Wpis.tsx), ale walidacja klienta chroni tylko klienta.
    // Warunek stoi tutaj, bo przez `validate` przechodzi i zapis, i edycja.
    if (dayPart === 'HOURS' && !(hourFrom && hourTo && hourTo > hourFrom)) {
      throw new BadRequestException('Wpis godzinowy wymaga zakresu godzin, w którym koniec jest późniejszy niż początek.');
    }

    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) throw new NotFoundException('Pracownik nie istnieje.');
    // FR-B9 — sygnalizacja nieobecności zaplanowanej po dacie zakończenia zatrudnienia.
    if (emp.endDate && from > emp.endDate) {
      throw new BadRequestException('Nieobecność zaplanowana po dacie zakończenia zatrudnienia/współpracy.');
    }

    const type = await this.prisma.absenceType.findUnique({ where: { id: typeId } });
    if (!type) throw new BadRequestException('Nieznany typ nieobecności.');

    const overlaps = await this.prisma.absence.findMany({
      where: { employeeId, id: excludeId ? { not: excludeId } : undefined, dateFrom: { lte: to }, dateTo: { gte: from } },
      include: { type: true },
    });
    if (collidesWith(overlaps, type)) {
      throw new ConflictException('Kolizja z istniejącym wpisem w tym terminie.');
    }

    const effectivelyConsumesPool = consumesPool(emp.employmentType, type.affectsPool);
    if (!effectivelyConsumesPool) return; // L4 na UoP — nie rusza puli, więc nie ma czego kontrolować

    const period = resolveBillingPeriod(emp.employmentType, from);
    const { pool, carriedOver } = await this.balance.effectivePool(emp, period);
    const holidays = await this.balance.holidaysFor(employeeId);

    // Wykorzystanie liczone RAZEM z nowym wpisem, nie przez dodanie jego dni z boku: przy
    // nakładaniu część dni jest już zajęta i policzyłaby się drugi raz, dając fałszywe
    // przekroczenie puli.
    const usedAfter = await this.usedInPeriod(employeeId, emp.employmentType, period, holidays, excludeId, {
      dateFrom: from, dateTo: to,
      overrides: !type.affectsPool,
      counts: true,
      fraction: dayFraction(dayPart, hourFrom ?? undefined, hourTo ?? undefined),
    });
    const available = pool + carriedOver;
    if (usedAfter > available) {
      throw new BadRequestException(`Przekroczenie puli: dostępne ${available} dni, po zapisie wykorzystanie ${usedAfter}.`);
    }
  }
}
