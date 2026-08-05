import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Roles } from './auth/decorators';

// FR-I1 / NFR-5 — podgląd dziennika audytu (tylko administrator).
@Roles('ADMIN')
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(entityId ? { entityId } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(Number(limit) || 100, 500),
    });
  }
}
