import { Body, Controller, Get, Put } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SetAllowanceDto, SetDefaultPoolDto } from './dto';
import { Roles } from './auth/decorators';

const DEFAULT_POOL_KEY = 'leavePool.default';

// FR-G2/B3/B6 — pula globalna (AdminSetting) + korekta indywidualna (LeaveAllowance).
@Controller('pools')
export class PoolsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('default')
  async getDefault() {
    const s = await this.prisma.adminSetting.findUnique({ where: { key: DEFAULT_POOL_KEY } });
    return { value: s ? Number(s.value) : null };
  }

  @Roles('ADMIN')
  @Put('default')
  setDefault(@Body() dto: SetDefaultPoolDto) {
    const value = String(dto.value);
    return this.prisma.adminSetting.upsert({
      where: { key: DEFAULT_POOL_KEY },
      create: { key: DEFAULT_POOL_KEY, value },
      update: { value },
    });
  }

  @Roles('ADMIN')
  @Put('allowance')
  setAllowance(@Body() dto: SetAllowanceDto) {
    const data = {
      baseDays: dto.baseDays,
      overrideDays: dto.overrideDays ?? null,
      carriedOver: dto.carriedOver ?? 0,
    };
    return this.prisma.leaveAllowance.upsert({
      where: { employeeId_periodYear: { employeeId: dto.employeeId, periodYear: dto.periodYear } },
      create: { employeeId: dto.employeeId, periodYear: dto.periodYear, ...data },
      update: data,
    });
  }
}
