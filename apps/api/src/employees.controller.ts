import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import type { PermissionScope } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from './prisma.service';
import { EmployeesService } from './employees.service';
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

  // M3 — pełny katalog (e-mail/login/rola/uprawnienia) tylko dla zarządzających; pozostali dostają
  // minimalny zestaw (id+imię+nazwisko+forma), bez ujawniania kontaktów i kto ma jakie uprawnienia.
  // Zawężenie dotyczy też WIERSZY: nieuprawnieni widzą wyłącznie swój Tribe (FR-H1), tak jak
  // w kalendarzu i „moim zespole" — inaczej każdy zalogowany pobierał spis całej firmy.
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const privileged = ['ADMIN', 'DIRECTOR', 'PMO'].includes(user.role)
      || user.permissions.includes('MODIFY_ABSENCE') || user.permissions.includes('VIEW_L4');
    if (privileged) {
      return this.prisma.employee.findMany({
        orderBy: { lastName: 'asc' },
        omit: { passwordHash: true },
        include: { permissions: { select: { scope: true } } },
      });
    }
    return this.prisma.employee.findMany({
      where: { id: { in: await this.org.tribePeers(user.sub) } },
      orderBy: { lastName: 'asc' },
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
