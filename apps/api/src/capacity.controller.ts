import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { CapacityService } from './capacity.service';
import { OrgService } from './org.service';
import { Roles } from './auth/decorators';
import { CurrentUser, type AuthUser } from './auth/current-user.decorator';

// FR-D2/D3 — planowanie capacity dla PO/Agile PM (i ról nadrzędnych). Nie dla zwykłego pracownika.
// H2 — PO/lider tylko jednostki w zasięgu swojego Tribe (Dyrektor/Admin: bez ograniczeń).
@Roles('PO', 'LEADER', 'DIRECTOR', 'ADMIN')
@Controller('capacity')
export class CapacityController {
  constructor(
    private readonly capacity: CapacityService,
    private readonly org: OrgService,
  ) {}

  @Get()
  async get(@Query('sprintId') sprintId: string, @Query('unitId') unitId: string, @CurrentUser() user: AuthUser) {
    await this.org.assertUnitInScope(user, unitId);
    return this.capacity.forSprint(sprintId, unitId);
  }

  /**
   * FR-C4 — capacity dla wielu par sprint × jednostka w jednym żądaniu.
   *
   * Heatmapa pokrycia pytała o każdą parę osobno: przy sześciu squadach i dwunastu sprintach
   * to 72 żądania na jedno wejście na ekran, każde z osobną weryfikacją tokenu, kontrolą zasięgu
   * i kompletem zapytań do bazy. Trafiało to w okno planowania sprintu, czyli w godzinę, w której
   * NFR-1 stawia najostrzejszy wymóg przy 300 równoczesnych użytkownikach.
   *
   * Ten sam kształt obsługuje ekran „Capacity sprintu" (jeden sprint × wszystkie squady), dlatego
   * komórka niesie też `keyRoleCollisions` — bez nich ekran musiałby dopytywać per squad i wracał
   * do pętli, którą ten endpoint likwiduje (FR-D3). Na heatmapie pole jest zwykle pustą tablicą.
   *
   * Kontrola zasięgu zostaje bez zmian — każda jednostka przechodzi przez `assertUnitInScope`,
   * tylko raz na jednostkę zamiast raz na parę. Pojedyncza para poza zasięgiem odrzuca całe
   * żądanie: cicha podmiana na wynik częściowy dałaby planiście niepełną siatkę wyglądającą
   * na pełną, a to gorsze niż błąd.
   */
  @Get('matrix')
  async matrix(
    @Query('sprintIds') sprintIds: string,
    @Query('unitIds') unitIds: string,
    @CurrentUser() user: AuthUser,
  ) {
    const sprints = (sprintIds ?? '').split(',').filter(Boolean);
    const units = (unitIds ?? '').split(',').filter(Boolean);
    if (sprints.length === 0 || units.length === 0) {
      throw new BadRequestException('Podaj co najmniej jeden sprint i jedną jednostkę.');
    }
    // Górny limit istnieje po to, żeby jedno żądanie nie zamieniło się w tysiąc zapytań do bazy.
    if (sprints.length * units.length > 240) {
      throw new BadRequestException('Zbyt duży zakres — ogranicz liczbę sprintów lub jednostek.');
    }
    for (const unitId of new Set(units)) await this.org.assertUnitInScope(user, unitId);

    const pary = units.flatMap((unitId) => sprints.map((sprintId) => ({ sprintId, unitId })));
    const komorka = async ({ sprintId, unitId }: { sprintId: string; unitId: string }) => {
      // Brakujący sprint lub jednostka to dziura w siatce, nie awaria całości — heatmapa
      // odróżnia brak pomiaru od zera i ma czym tę różnicę pokazać.
      try {
        const c = await this.capacity.forSprint(sprintId, unitId);
        return { sprintId, unitId, totalPersonDays: c.totalPersonDays, absentPersonDays: c.absentPersonDays, available: c.available, memberCount: c.memberCount, keyRoleCollisions: c.keyRoleCollisions };
      } catch {
        return { sprintId, unitId, totalPersonDays: null, absentPersonDays: null, available: null, memberCount: null, keyRoleCollisions: [] };
      }
    };

    // Partiami, nie wszystko naraz. Górny limit 240 par ogranicza ROZMIAR żądania, ale nie
    // współbieżność: każda komórka to kilka zapytań, więc `Promise.all` po całości wypuszczał
    // do tysiąca zapytań jednocześnie przy puli połączeń Prismy rzędu kilkunastu. Nadmiar
    // i tak czekał w kolejce — tyle że w kolejce, w której nie działo się nic innego, łącznie
    // z sondą /health i żądaniami pozostałych użytkowników.
    // ponytail: stały rozmiar partii wystarcza przy 240 komórkach. Gdyby siatka miała rosnąć,
    // właściwym krokiem jest pobranie danych raz na jednostkę i policzenie sprintów w pamięci.
    const PARTIA = 8;
    const cells: Awaited<ReturnType<typeof komorka>>[] = [];
    for (let i = 0; i < pary.length; i += PARTIA) {
      cells.push(...await Promise.all(pary.slice(i, i + PARTIA).map(komorka)));
    }
    return { cells };
  }
}
