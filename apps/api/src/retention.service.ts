import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { EmployeesService } from './employees.service';
import { SettingsService } from './settings.service';
import type { AuthUser } from './auth/current-user.decorator';

// FR-J2 — retencja: anonimizacja byłych pracowników po upływie okresu przechowywania.
// Uruchamiać harmonogramem (cron → endpoint admina), jak przypomnienia.
@Injectable()
export class RetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly settings: SettingsService,
  ) {}

  async runRetention(user: AuthUser): Promise<{ months: number; anonymized: number }> {
    const months = await this.settings.getNumber('retention.months');
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - months);

    const expired = await this.prisma.employee.findMany({
      where: { endDate: { lte: cutoff }, NOT: { login: { startsWith: 'anon-' } } },
    });
    let anonymized = 0;
    for (const e of expired) {
      const r = await this.employees.anonymize(e.id, user);
      if (r.anonymized) anonymized++;
    }
    return { months, anonymized };
  }
}
