import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Roles } from './auth/decorators';

// NFR-8 — wskaźnik adopcji dla administratora i PMO.
@Roles('ADMIN', 'PMO')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('adoption')
  adoption() {
    return this.analytics.adoption();
  }
}
