import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Public } from './auth/decorators';

// NFR-2 — sonda dostępności dla monitoringu/SLA. 200 = żywe + baza OK; 503 = baza niedostępna.
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    let db = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    if (db === 'down') throw new ServiceUnavailableException({ status: 'error', db });
    return { status: 'ok', db, uptimeSec: Math.round(process.uptime()), version: '1.0' };
  }
}
