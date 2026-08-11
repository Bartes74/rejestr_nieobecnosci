import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import type { PermissionScope } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from './prisma.service';
import { EmployeesService, HIDDEN_EMPLOYEE_FIELDS } from './employees.service';
import { OrgService } from './org.service';
import { ChangeEmploymentTypeDto, ChangeRoleDto, CreateEmployeeDto, GrantPermissionDto, SetPasswordDto } from './dto';
import { parseMapping } from './import-mapping';
import { Roles } from './auth/decorators';
import { CurrentUser, type AuthUser } from './auth/current-user.decorator';

@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly org: OrgService,
  ) {}

  // M3 — katalog odpowiada na DWA niezależne pytania, wcześniej zlane w jedną flagę `privileged`:
  // które WIERSZE wolno zobaczyć i które POLA z wiersza. Zlanie ich znaczyło, że kto potrzebuje
  // szerszej listy osób, dostaje przy okazji dane administracyjne całej firmy.
  //
  // Uderzało to w uprawnienia delegowane (FR-H4). MODIFY_ABSENCE i VIEW_L4 nadaje się imiennie,
  // zwykle komuś z rolą EMPLOYEE — kadrom albo asystentce wpisującej nieobecności za innych.
  // Taka osoba faktycznie potrzebuje WIERSZY spoza swojego Tribe (wpisuje w całej firmie), ale
  // do wskazania człowieka wystarczy jej imię i nazwisko. Dostawała natomiast e-maile i loginy
  // wszystkich oraz mapę „kto ma jakie uprawnienie" — czyli gotową listę celów: komu odebranie
  // hasła daje wgląd w znacznik L4. Nadanie wąskiego uprawnienia otwierało widok administracyjny.
  //
  // Stąd podział: zasięg wierszy zostaje szeroki tam, gdzie wynika z zadania, a pola
  // administracyjne schodzą do ról, których ekrany faktycznie ich używają. Mapa uprawnień idzie
  // wyłącznie do administratora, bo tylko jego ekran (Pracownicy) nią zarządza; dyrektor i PMO
  // zachowują katalog z kontaktami (Konfiguracja i raporty), ale bez mapy uprawnień.
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const orgWide = ['ADMIN', 'DIRECTOR', 'PMO'].includes(user.role);
    const delegat = user.permissions.includes('MODIFY_ABSENCE') || user.permissions.includes('VIEW_L4');
    // Zasięg wierszy: całą firmę widzą role ogólnofirmowe i posiadacze uprawnień delegowanych
    // (działają poza własnym Tribe). Reszta — własny Tribe (FR-H1), jak w kalendarzu.
    const where = orgWide || delegat ? {} : { id: { in: await this.org.tribePeers(user.sub) } };
    const orderBy = { lastName: 'asc' } as const;

    if (user.role === 'ADMIN') {
      return this.prisma.employee.findMany({
        where, orderBy, omit: HIDDEN_EMPLOYEE_FIELDS, include: { permissions: { select: { scope: true } } },
      });
    }
    if (orgWide) return this.prisma.employee.findMany({ where, orderBy, omit: HIDDEN_EMPLOYEE_FIELDS });
    return this.prisma.employee.findMany({
      where, orderBy,
      select: { id: true, firstName: true, lastName: true, employmentType: true },
    });
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  // FR-G5 — import .xlsx (multipart, pole "file"); tylko administrator.
  // Opcjonalne pole "mapping" (JSON) nadpisuje nazwy kolumn (konfigurowalne mapowanie nagłówków).
  @Roles('ADMIN')
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } })) // M2 — limit DoS
  import(@UploadedFile() file: { buffer: Buffer }, @Body('mapping') mapping?: string) {
    return this.employees.importXlsx(file.buffer, parseMapping(mapping));
  }

  @Roles('ADMIN')
  @Put(':id/password')
  async setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto) {
    await this.employees.setPassword(id, dto.password);
    return { ok: true };
  }

  // FR-B8 — zmiana formy zatrudnienia.
  @Roles('ADMIN')
  @Patch(':id/employment-type')
  changeEmploymentType(@Param('id') id: string, @Body() dto: ChangeEmploymentTypeDto, @CurrentUser() user: AuthUser) {
    return this.employees.changeEmploymentType(id, dto.employmentType, user);
  }

  // FR-H4 — role i uprawnienia rozszerzone.
  @Roles('ADMIN')
  @Patch(':id/role')
  changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto, @CurrentUser() user: AuthUser) {
    return this.employees.changeRole(id, dto.role, user);
  }

  @Roles('ADMIN')
  @Get(':id/permissions')
  listPermissions(@Param('id') id: string) {
    return this.employees.listPermissions(id);
  }

  @Roles('ADMIN')
  @Post(':id/permissions')
  grant(@Param('id') id: string, @Body() dto: GrantPermissionDto, @CurrentUser() user: AuthUser) {
    return this.employees.grantPermission(id, dto.scope, user);
  }

  @Roles('ADMIN')
  @Delete(':id/permissions/:scope')
  revoke(@Param('id') id: string, @Param('scope') scope: PermissionScope, @CurrentUser() user: AuthUser) {
    return this.employees.revokePermission(id, scope, user);
  }

  // FR-J2 — anonimizacja na żądanie (prawo do bycia zapomnianym).
  @Roles('ADMIN')
  @Post(':id/anonymize')
  anonymize(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.employees.anonymize(id, user);
  }
}
