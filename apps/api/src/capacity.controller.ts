import { Controller, Get, Query } from '@nestjs/common';
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
}
