import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { EmployeesService } from './employees.service';
import type { AuthUser } from './auth/current-user.decorator';

const RETENTION_KEY = 'retention.months';

// FR-J2 — retencja: anonimizacja byłych pracowników po upływie okresu przechowywania.
// Uruchamiać harmonogramem (cron → endpoint admina), jak przypomnienia.
@Injectable()
export class RetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
  ) {}

  async runRetention(user: AuthUser): Promise<{ months: number; anonymized: number }> {
    const s = await this.prisma.adminSetting.findUnique({ where: { key: RETENTION_KEY } });
    const months = s ? Number(s.value) : 24;
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
