import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateAbsenceTypeDto, ReorderAbsenceTypesDto, UpdateAbsenceTypeDto } from './dto';
import { Roles } from './auth/decorators';

// Jedna kolejność dla całej aplikacji: najpierw to, co ustawił administrator, potem alfabet
// jako rozstrzygnięcie remisów (dwa typy dodane tego samego dnia mają sortOrder 0).
const ORDER = [{ sortOrder: 'asc' as const }, { name: 'asc' as const }];

// FR-G1 — zarządzanie typami nieobecności (live, bez zmian w kodzie).
@Controller('absence-types')
export class AbsenceTypesController {
  constructor(private readonly prisma: PrismaService) {}

  // Listę widzą wszyscy zalogowani (potrzebna w formularzu wpisu).
  @Get()
  list() {
    return this.prisma.absenceType.findMany({ orderBy: ORDER });
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateAbsenceTypeDto) {
    // Nowy typ ląduje na końcu listy, nie w środku. Domyślne 0 wrzucałoby go na czoło
    // (albo w losowe miejsce alfabetu) i po cichu zmieniało wybór domyślny w formularzu wpisu.
    const last = await this.prisma.absenceType.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    return this.prisma.absenceType.create({ data: { ...dto, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAbsenceTypeDto) {
    return this.prisma.absenceType.update({ where: { id }, data: dto });
  }

  /**
   * Zapis całej kolejności naraz. Osobny endpoint zamiast wielu PATCH-y po jednym typie,
   * bo przestawienie to jedna decyzja administratora: albo zapisuje się w całości, albo wcale.
   * Dwa równoległe przesunięcia po stronie klienta potrafiłyby zostawić dwa typy z tym samym
   * numerem i kolejność zależną od tego, które żądanie dobiegło pierwsze.
   */
  @Roles('ADMIN')
  @Patch('order/all')
  async reorder(@Body() dto: ReorderAbsenceTypesDto) {
    const known = await this.prisma.absenceType.findMany({ select: { id: true } });
    const ids = new Set(known.map((t) => t.id));
    if (dto.ids.length !== ids.size || dto.ids.some((id) => !ids.delete(id))) {
      // Niepełna albo nieaktualna lista oznacza, że ktoś w międzyczasie dodał lub usunął typ.
      // Zapisanie jej wprost zostawiłoby typy spoza listy z osieroconym numerem.
      throw new BadRequestException('Lista kolejności nie zgadza się z typami w bazie — odśwież widok i spróbuj ponownie.');
    }
    await this.prisma.$transaction(
      dto.ids.map((id, i) => this.prisma.absenceType.update({ where: { id }, data: { sortOrder: i } })),
    );
    return this.prisma.absenceType.findMany({ orderBy: ORDER });
  }
}
