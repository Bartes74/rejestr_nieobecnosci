import { Controller, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Roles } from './auth/decorators';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // FR-E3 — uruchomienie przypomnień o zaległym urlopie (admin lub cron z tokenem admina).
  @Roles('ADMIN')
  @Post('overdue-reminders')
  overdueReminders() {
    return this.notifications.sendOverdueReminders();
  }
}
