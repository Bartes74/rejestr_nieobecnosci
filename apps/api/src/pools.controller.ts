import { Body, Controller, Get, Put } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SetAllowanceDto, SetDefaultPoolDto } from './dto';
import { Roles } from './auth/decorators';
import { DEFAULT_POOL_KEY, POOL_KEY_PREFIX } from './balance.service';

// FR-G2/B3/B6 — pula globalna (AdminSetting), osobna per forma zatrudnienia,
// + korekta indywidualna (LeaveAllowance).
@Controller('pools')
export class PoolsController {
  constructor(private readonly prisma: PrismaService) {}

  // `value` = wspólny fallback, `byType` = wartości ustawione wprost (null = „dziedziczy fallback").
  // Surowo, nie rozstrzygnięte: administrator ma widzieć, czy forma ma własną pulę, czy nie.
  @Get('default')
  async getDefault() {
    const rows = await this.prisma.adminSetting.findMany({ where: { key: { startsWith: POOL_KEY_PREFIX } } });
    const at = (key: string) => { const r = rows.find((x) => x.key === key); return r ? Number(r.value) : null; };
    return {
      value: at(DEFAULT_POOL_KEY),
      byType: { UOP: at(`${POOL_KEY_PREFIX}UOP`), B2B: at(`${POOL_KEY_PREFIX}B2B`), OUT: at(`${POOL_KEY_PREFIX}OUT`) },
    };
  }

  @Roles('ADMIN')
  @Put('default')
  setDefault(@Body() dto: SetDefaultPoolDto) {
    const key = dto.employmentType ? POOL_KEY_PREFIX + dto.employmentType : DEFAULT_POOL_KEY;
    const value = String(dto.value);
    return this.prisma.adminSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  @Roles('ADMIN')
  @Put('allowance')
  setAllowance(@Body() dto: SetAllowanceDto) {
    const data = {
      baseDays: dto.baseDays,
      overrideDays: dto.overrideDays ?? null,
      // Brak wartości = `null` = wylicz zaległe z poprzednich okresów (FR-B7). Zapisanie tu zera
      // zamrażałoby saldo na zerze i wyłączało rolowanie dla tej osoby.
      carriedOver: dto.carriedOver ?? null,
    };
    return this.prisma.leaveAllowance.upsert({
      where: { employeeId_periodYear: { employeeId: dto.employeeId, periodYear: dto.periodYear } },
      create: { employeeId: dto.employeeId, periodYear: dto.periodYear, ...data },
      update: data,
    });
  }
}
