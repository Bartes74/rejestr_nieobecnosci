import { Controller, ForbiddenException, Get, Param } from '@nestjs/common';
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

  @Get()
  async get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (id !== user.sub && !canModifyOthers(user) && !canViewL4(user)
      && !(user.role === 'LEADER' && (await this.org.tribePeers(user.sub)).includes(id))) {
      throw new ForbiddenException('Brak dostępu do salda urlopu tej osoby.');
    }
    return this.balance.current(id);
  }
}
