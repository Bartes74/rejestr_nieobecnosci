import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { RetentionService } from './retention.service';
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
}
