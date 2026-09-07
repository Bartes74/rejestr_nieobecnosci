import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { RetentionService } from './retention.service';
import { PrismaService } from './prisma.service';
import { ensureDefaultPolishHolidays } from './holidays.controller';
import type { AuthUser } from './auth/current-user.decorator';

// B1 / FR-E3 + FR-J2 — automatyzacja przypomnień o zaległym urlopie i retencji (cron codziennie 02:00),
// delegująca do istniejących serwisów. Włączane przez SCHEDULER_ENABLED=true — dev/CI/suity verify
// (gdzie też startuje API) nie odpalają skutków ubocznych. Endpointy manualne pozostają.
const SYSTEM: AuthUser = { sub: 'system', role: 'ADMIN', permissions: [] };

@Injectable()
export class SchedulerService {
  private readonly log = new Logger('Scheduler');
  constructor(
    private readonly notifications: NotificationsService,
    private readonly retention: RetentionService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 2 * * *')
  async dailyReminders() {
    if (process.env.SCHEDULER_ENABLED !== 'true') return;
    const r = await this.notifications.sendOverdueReminders();
    this.log.log(`Przypomnienia o zaległym urlopie wysłane: ${r.sent}`);
  }

  @Cron('0 2 * * *')
  async dailyRetention() {
    if (process.env.SCHEDULER_ENABLED !== 'true') return;
    const r = await this.retention.runRetention(SYSTEM);
    this.log.log(`Retencja: zanonimizowano ${r.anonymized} (okres ${r.months} mies.)`);
  }

  // FR-G3/G7 — kalendarz domyślny zawsze ma święta na bieżący i następny rok; bez tego import był
  // ręczny per rok i o nim zapominano (uwaga zleceniodawcy: 11 listopada jako dzień pracy).
  @Cron('0 3 * * *')
  async dailyHolidays() {
    if (process.env.SCHEDULER_ENABLED !== 'true') return;
    const r = await ensureDefaultPolishHolidays(this.prisma);
    this.log.log(r ? `Święta PL w kalendarzu domyślnym: dopisano ${r.added}` : 'Brak kalendarza domyślnego — świąt nie uzupełniono');
  }
}
