import { Injectable } from '@nestjs/common';
import { isoDate } from '@nieobecnosci/core';
import { PrismaService } from './prisma.service';
import { OrgService } from './org.service';
import { MailService } from './mail.service';
import { SettingsService } from './settings.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly org: OrgService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
  ) {}

  // FR-E1 — lider dostaje informację o planowanej nieobecności współpracownika B2B/OUT.
  async notifyLeadersOfAbsence(employeeId: string, dateFrom: Date, dateTo: Date): Promise<void> {
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp || (emp.employmentType !== 'B2B' && emp.employmentType !== 'OUT')) return;
    const peers = await this.org.tribePeers(employeeId);
    const leaders = await this.prisma.employee.findMany({ where: { id: { in: peers }, role: 'LEADER' } });
    for (const l of leaders) {
      await this.mail.send(
        l.email,
        'Planowana nieobecność współpracownika',
        `${emp.firstName} ${emp.lastName} (${emp.employmentType}) planuje nieobecność ${isoDate(dateFrom)}–${isoDate(dateTo)}. Wpis ma charakter informacyjny — bez akceptacji.`,
        l.id,
      );
    }
  }

  // FR-E3 — przypomnienia o zaległym urlopie wg reguły administratora (próg dni zaległych,
  // konfigurowalny w /settings). Wyzwalane harmonogramem (cron → endpoint admina).
  async sendOverdueReminders(): Promise<{ sent: number; minCarriedOver: number }> {
    const minCarriedOver = await this.settings.getNumber('reminder.minCarriedOver');
    const allowances = await this.prisma.leaveAllowance.findMany({ where: { carriedOver: { gte: minCarriedOver } }, include: { employee: true } });
    for (const a of allowances) {
      await this.mail.send(
        a.employee.email,
        'Przypomnienie: zaległy urlop',
        `Masz ${a.carriedOver} dni zaległego urlopu. Zaplanuj jego wykorzystanie — dni nie przepadają, ale warto je rozplanować.`,
        a.employee.id,
      );
    }
    return { sent: allowances.length, minCarriedOver };
  }
}
