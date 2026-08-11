import { Injectable } from '@nestjs/common';
import { isoDate, todayUtc } from '@nieobecnosci/core';
import { PrismaService } from './prisma.service';
import { OrgService } from './org.service';
import { MailService } from './mail.service';
import { SettingsService } from './settings.service';
import { BalanceService } from './balance.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly org: OrgService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly balance: BalanceService,
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

  /**
   * FR-E3 — przypomnienia o zaległym urlopie wg progu z konfiguracji administratora.
   * Wyzwalane harmonogramem (cron → endpoint admina).
   *
   * Zaległe dni liczy `BalanceService`, ten sam, z którego korzysta licznik na pulpicie
   * i powiadomienia w aplikacji. Wcześniej filtrem była kolumna `LeaveAllowance.carriedOver`,
   * a to pomijało regułę, o którą chodzi: `null` w tej kolumnie oznacza „wylicz z łańcucha
   * poprzednich okresów" i JEST przypadkiem domyślnym, tymczasem w SQL `NULL >= 1` daje `NULL`,
   * więc taki wiersz nie pasował do warunku. Przypomnienia szły więc wyłącznie do osób
   * z ręczną korektą administratora — a zadanie nocne raportowało „wysłane: 0" i wyglądało
   * na działające. Ta sama reguła nie może mieć dwóch prawd, raz w aplikacji, raz w mailu.
   *
   * ponytail: pętla po pracownikach, jedno przeliczenie salda na osobę. Zadanie nocne przy
   * kilkuset osobach; przy tysiącach przejść na odczyt wsadowy jak w ReportsService.usage.
   */
  async sendOverdueReminders(): Promise<{ sent: number; minCarriedOver: number }> {
    const minCarriedOver = await this.settings.getNumber('reminder.minCarriedOver');
    const today = todayUtc();
    // Byli pracownicy i konta zanonimizowane odpadają: pierwszym nie ma co przypominać
    // o planowaniu urlopu, drudzy mają adres `@example.invalid`, więc list i tak by odbił.
    const employees = await this.prisma.employee.findMany({
      where: { OR: [{ endDate: null }, { endDate: { gte: today } }] },
      select: { id: true, email: true, login: true },
    });

    let sent = 0;
    for (const e of employees) {
      if (e.login.startsWith('anon-')) continue;
      const bal = await this.balance.current(e.id).catch(() => null);
      if (!bal || bal.carriedOver < minCarriedOver) continue;
      await this.mail.send(
        e.email,
        'Przypomnienie: zaległy urlop',
        `Masz ${bal.carriedOver} dni zaległego urlopu. Zaplanuj jego wykorzystanie — dni nie przepadają, ale warto je rozplanować.`,
        e.id,
      );
      sent++;
    }
    return { sent, minCarriedOver };
  }
}
