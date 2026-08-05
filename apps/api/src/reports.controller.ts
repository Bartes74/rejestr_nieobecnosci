import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { OrgService } from './org.service';
import { Roles } from './auth/decorators';
import { CurrentUser, type AuthUser } from './auth/current-user.decorator';

// FR-F2/F3 — raporty dla ról kierowniczych/PMO (nie dla zwykłego pracownika).
// H2 — lider widzi tylko jednostki w zasięgu swojego Tribe (role org-wide: bez ograniczeń).
@Roles('LEADER', 'DIRECTOR', 'ADMIN', 'PMO')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly org: OrgService,
  ) {}

  @Get('usage')
  async usage(@Query('unitId') unitId: string, @CurrentUser() user: AuthUser) {
    await this.org.assertUnitInScope(user, unitId);
    return this.reports.usage(unitId);
  }

  @Get('tree')
  async tree(@Query('unitId') unitId: string, @CurrentUser() user: AuthUser) {
    await this.org.assertUnitInScope(user, unitId);
    return this.reports.tree(unitId);
  }

  // FR-F5 — kto zalega z wybraniem urlopu.
  @Get('overdue')
  async overdue(@Query('unitId') unitId: string, @CurrentUser() user: AuthUser, @Query('threshold') threshold?: string) {
    await this.org.assertUnitInScope(user, unitId);
    return this.reports.overdue(unitId, threshold ? Number(threshold) : undefined);
  }

  // FR-F6 — stabilny, wersjonowany eksport dla płac/PMO (i jego schemat).
  @Roles('PMO', 'ADMIN')
  @Get('export/payroll/schema')
  payrollSchema() {
    return this.reports.payrollSchema();
  }

  @Roles('PMO', 'ADMIN')
  @Get('export/payroll')
  payroll(@Query('unitId') unitId: string, @CurrentUser() user: AuthUser) {
    return this.reports.payrollExport(unitId, user);
  }

  // FR-F1 — eksport .xlsx (RODO-safe: tylko dni, bez typów/L4).
  @Get('usage/export')
  async exportUsage(@Query('unitId') unitId: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    await this.org.assertUnitInScope(user, unitId);
    const buf = await this.reports.usageXlsx(unitId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="raport-urlopy.xlsx"',
    });
    res.end(buf);
  }
}
