import { BadRequestException, Body, Controller, Get, NotFoundException, Put } from '@nestjs/common';
import type { EmploymentType } from '@prisma/client';
import { minPoolFor } from '@nieobecnosci/core';
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
  //
  // Odczyt zawężony do ról, które faktycznie go używają (Raporty, Konfiguracja) — zgodnie
  // z macierzą RBAC w README. Pracownik widzi własną pulę przez `/employees/:id/balance`,
  // a nie przez ustawienia organizacji.
  @Roles('LEADER', 'DIRECTOR', 'ADMIN', 'PMO')
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
  async setDefault(@Body() dto: SetDefaultPoolDto) {
    // Minimum formy (reguła zamawiającego: B2B i OUT co najmniej 20 dni) sprawdzane na puli
    // EFEKTYWNEJ po zapisie, nie na wpisywanej liczbie: forma bez własnej wartości dziedziczy
    // wspólną, więc wspólna 10 przy braku klucza B2B też zaniżałaby B2B poniżej 20.
    const cur = await this.getDefault();
    const shared = dto.employmentType ? cur.value : dto.value;
    const byType: Record<EmploymentType, number | null> = { ...cur.byType };
    if (dto.employmentType) byType[dto.employmentType] = dto.value;
    for (const t of ['B2B', 'OUT'] as const) {
      const eff = byType[t] ?? shared;
      if (eff !== null && eff < minPoolFor(t)) {
        throw new BadRequestException(`Pula dla ${t} nie może być mniejsza niż ${minPoolFor(t)} dni (po zapisie wyniosłaby ${eff}).`);
      }
    }
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
  async setAllowance(@Body() dto: SetAllowanceDto) {
    const emp = await this.prisma.employee.findUnique({ where: { id: dto.employeeId }, select: { employmentType: true } });
    if (!emp) throw new NotFoundException('Pracownik nie istnieje.');
    // Korekta indywidualna jest wartością docelową (bez proraty), więc minimum formy dotyczy jej wprost;
    // inaczej jedno pole omijałoby regułę, którą pilnuje pula domyślna.
    const min = minPoolFor(emp.employmentType);
    if ((dto.overrideDays ?? dto.baseDays) < min) {
      throw new BadRequestException(`Korekta dla ${emp.employmentType} nie może ustawić puli poniżej ${min} dni.`);
    }
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
