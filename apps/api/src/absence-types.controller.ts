import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateAbsenceTypeDto, UpdateAbsenceTypeDto } from './dto';
import { Roles } from './auth/decorators';

// FR-G1 — zarządzanie typami nieobecności (live, bez zmian w kodzie).
@Controller('absence-types')
export class AbsenceTypesController {
  constructor(private readonly prisma: PrismaService) {}

  // Listę widzą wszyscy zalogowani (potrzebna w formularzu wpisu).
  @Get()
  list() {
    return this.prisma.absenceType.findMany({ orderBy: { name: 'asc' } });
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateAbsenceTypeDto) {
    return this.prisma.absenceType.create({ data: dto });
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAbsenceTypeDto) {
    return this.prisma.absenceType.update({ where: { id }, data: dto });
  }
}
