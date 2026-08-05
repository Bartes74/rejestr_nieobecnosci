import { Controller, Post } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { Roles } from './auth/decorators';
import { CurrentUser, type AuthUser } from './auth/current-user.decorator';

@Controller('retention')
export class RetentionController {
  constructor(private readonly retention: RetentionService) {}

  // FR-J2 — uruchomienie retencji (admin lub cron z tokenem admina).
  @Roles('ADMIN')
  @Post('run')
  run(@CurrentUser() user: AuthUser) {
    return this.retention.runRetention(user);
  }
}
