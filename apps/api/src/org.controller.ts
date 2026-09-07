import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OrgService } from './org.service';
import { CreateMembershipDto, CreateOrgUnitDto, SetUnitLeaderDto } from './dto';
import { Roles } from './auth/decorators';
import { CurrentUser, type AuthUser } from './auth/current-user.decorator';
import { canModifyOthers } from './auth/rbac';

// FR-G4 — struktura organizacyjna (drzewo) i przypisanie osób do wielu jednostek.
@Controller('org')
export class OrgController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly org: OrgService,
  ) {}

  // Tylko jednostki w zasięgu pytającego — lista musi zgadzać się z assertUnitInScope,
  // inaczej picker w UI oferuje wybory kończące się 403 (FR-H1/H2).
  @Get('units')
  units(@CurrentUser() user: AuthUser) {
    return this.org.visibleUnits(user);
  }

  // FR-A5 — „mój zespół": osoby, których nieobecności bieżący użytkownik może edytować.
  // Lider → członkowie jego Tribe (bez siebie); admin/MODIFY_ABSENCE → wszyscy; pozostali → pusto.
  @Get('my-team')
  async myTeam(@CurrentUser() user: AuthUser) {
    let ids: string[] | null = null; // null = wszyscy (admin/MODIFY)
    if (!canModifyOthers(user)) {
      if (user.role !== 'LEADER') return [];
      ids = (await this.org.tribePeers(user.sub)).filter((id) => id !== user.sub);
    }
    return this.prisma.employee.findMany({
      where: ids ? { id: { in: ids } } : undefined,
      orderBy: { lastName: 'asc' },
      select: { id: true, firstName: true, lastName: true, employmentType: true },
    });
  }

  // Drzewo Pion›Departament›Tribe›Chapter›Squad, przycięte do zasięgu pytającego.
  @Get('tree')
  tree(@CurrentUser() user: AuthUser) {
    return this.org.visibleTree(user);
  }

  @Roles('ADMIN')
  @Post('units')
  createUnit(@Body() dto: CreateOrgUnitDto) {
    return this.prisma.orgUnit.create({ data: dto });
  }

  @Roles('ADMIN')
  @Post('memberships')
  addMember(@Body() dto: CreateMembershipDto) {
    return this.prisma.orgUnitMembership.create({ data: dto });
  }

  // Lider jednostki wskazuje ADMIN albo DIRECTOR (feedback002) — dyrektor nie ma Konfiguracji,
  // a to on planuje wokół nieobecności liderów. `assertUnitInScope` dla porządku: obie role są
  // org-wide, ale kontrakt „jednostka w zasięgu pytającego" ma obowiązywać każdego, kto tu trafi.
  @Roles('ADMIN', 'DIRECTOR')
  @Patch('units/:id/leader')
  async setLeader(@Param('id') id: string, @Body() dto: SetUnitLeaderDto, @CurrentUser() user: AuthUser) {
    await this.org.assertUnitInScope(user, id);
    return this.org.setLeader(id, dto.leaderId ?? null, user);
  }

  // Kandydaci na lidera: członkowie poddrzewa jednostki. Zwraca tylko to, co potrzebne do selecta.
  @Get('units/:id/members')
  async members(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.org.assertUnitInScope(user, id);
    const ids = await this.org.employeeIdsInUnit(id);
    return this.prisma.employee.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }
}
