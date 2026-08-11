import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// NFR-8 — analityka adopcji liczona z dziennika audytu (kto wpisuje, logowania, tarcia).
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async adoption() {
    const [totalEmployees, activeRows, absencesCreated, logins, securityEvents] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.auditLog.findMany({ where: { action: 'ABSENCE_CREATE', userId: { not: null } }, distinct: ['userId'], select: { userId: true } }),
      this.prisma.auditLog.count({ where: { action: 'ABSENCE_CREATE' } }),
      this.prisma.auditLog.count({ where: { action: 'LOGIN_SUCCESS' } }),
      this.prisma.auditLog.count({ where: { action: { in: ['LOGIN_FAILED', 'ACCESS_DENIED'] } } }),
    ]);
    const activeUsers = activeRows.length;
    const adoptionRate = totalEmployees > 0 ? Math.round((activeUsers / totalEmployees) * 100) : 0;
    return { totalEmployees, activeUsers, adoptionRate, kpiTarget: 80, absencesCreated, logins, securityEvents };
  }
}
