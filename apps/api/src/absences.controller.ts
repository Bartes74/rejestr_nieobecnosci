import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import type { DayPart } from '@prisma/client';
import { AbsencesService } from './absences.service';
import { BulkCreateAbsenceDto, CreateAbsenceDto, UpdateAbsenceDto } from './dto';
import { CurrentUser, type AuthUser } from './auth/current-user.decorator';

@Controller('absences')
export class AbsencesController {
  constructor(private readonly absences: AbsencesService) {}

  @Get()
  list(@Query('employeeId') employeeId: string, @CurrentUser() user: AuthUser) {
    return this.absences.listForEmployee(employeeId, user);
  }

  @Get('preview')
  preview(
    @Query('employeeId') employeeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthUser,
    @Query('dayPart') dayPart?: DayPart,
    @Query('hourFrom') hourFrom?: string,
    @Query('hourTo') hourTo?: string,
    @Query('typeId') typeId?: string,
  ) {
    return this.absences.preview(employeeId, from, to, user, dayPart ?? 'FULL', hourFrom, hourTo, typeId);
  }

  @Post()
  create(@Body() dto: CreateAbsenceDto, @CurrentUser() user: AuthUser) {
    return this.absences.create(dto, user);
  }

  // FR-A10 — operacje masowe (jedna nieobecność dla wielu osób). RBAC egzekwowane per pracownik wewnątrz.
  @Post('bulk')
  createBulk(@Body() dto: BulkCreateAbsenceDto, @CurrentUser() user: AuthUser) {
    return this.absences.createBulk(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAbsenceDto, @CurrentUser() user: AuthUser) {
    return this.absences.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.absences.remove(id, user);
  }

  // FR-B10 — konwersja na L4 (osoba uprawniona).
  @Post(':id/convert-to-l4')
  convertToL4(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.absences.convertToL4(id, user);
  }
}
