import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { SchedulerService } from './scheduler.service';
import { HealthController } from './health.controller';
import { AbsenceTypesController } from './absence-types.controller';
import { HolidaysController } from './holidays.controller';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';
import { PoolsController } from './pools.controller';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { AbsencesController } from './absences.controller';
import { AbsencesService } from './absences.service';
import { CalendarController } from './calendar.controller';
import { CalendarFeedController } from './calendar-feed.controller';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';
import { CapacityController } from './capacity.controller';
import { CapacityService } from './capacity.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AuditController } from './audit.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsFeedController } from './notifications-feed.controller';
import { NotificationsService } from './notifications.service';
import { MailService } from './mail.service';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { ProcessingRegisterController } from './processing-register.controller';
import { AnalyticsController, AnalyticsService } from './analytics.controller';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuthProvider, LocalAuthProvider } from './auth/auth-provider';
import { AuthGuard } from './auth/auth.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // M1 — globalny limit 300/min/IP (ochrona DoS); na /auth/login surowszy 5/min (@Throttle).
    // Aktywny tylko w produkcji, by dev/CI/suity i test obciążeniowy nie były ograniczane.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 300 }], skipIf: () => process.env.NODE_ENV !== 'production' }),
  ],
  controllers: [
    HealthController,
    AuthController,
    AbsenceTypesController,
    HolidaysController,
    OrgController,
    PoolsController,
    EmployeesController,
    BalanceController,
    AbsencesController,
    CalendarController,
    CalendarFeedController,
    SprintsController,
    CapacityController,
    ReportsController,
    AuditController,
    NotificationsController,
    NotificationsFeedController,
    RetentionController, SettingsController,
    ProcessingRegisterController,
    AnalyticsController,
  ],
  providers: [
    PrismaService,
    AuthService,
    { provide: AuthProvider, useClass: LocalAuthProvider }, // FR-H5 — provider wymienialny (lokalny → OIDC)
    OrgService,
    EmployeesService,
    BalanceService,
    AbsencesService,
    SprintsService,
    CapacityService,
    ReportsService,
    MailService,
    NotificationsService,
    RetentionService, SettingsService,
    AnalyticsService,
    SchedulerService,
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // M1 — rate-limiting (prod-only przez skipIf)
    { provide: APP_GUARD, useClass: AuthGuard }, // globalna ochrona tras (poza @Public)
  ],
})
export class AppModule {}
