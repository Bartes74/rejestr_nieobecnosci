import { BadRequestException, Controller, ForbiddenException, Get, Param, Query } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { OrgService } from './org.service';
import { CurrentUser, type AuthUser } from './auth/current-user.decorator';
import { canModifyOthers, canViewL4 } from './auth/rbac';

// FR-B2 — licznik balansu (pula / wykorzystano / pozostało) liczony przez @nieobecnosci/core.
// H1 — saldo to dana osobowa: dostęp tylko własny lub dla uprawnionych (admin/VIEW_L4/MODIFY/lider w Tribe).
@Controller('employees/:id/balance')
export class BalanceController {
  constructor(
    private readonly balance: BalanceService,
    private readonly org: OrgService,
  ) {}

  // `?year=` — okres o danym numerze roku zamiast bieżącego (przełącznik okresu na pulpicie).
  @Get()
  async get(@Param('id') id: string, @CurrentUser() user: AuthUser, @Query('year') year?: string) {
    if (id !== user.sub && !canModifyOthers(user) && !canViewL4(user)
      && !(user.role === 'LEADER' && (await this.org.tribePeers(user.sub)).includes(id))) {
      throw new ForbiddenException('Brak dostępu do salda urlopu tej osoby.');
    }
    const y = year === undefined || year === '' ? undefined : Number(year);
    if (y !== undefined && !Number.isInteger(y)) throw new BadRequestException('Parametr „year" musi być rokiem, np. 2027.');
    return this.balance.current(id, y);
  }
}
