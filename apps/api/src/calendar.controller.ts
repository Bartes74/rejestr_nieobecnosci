import { Controller, Get, Query } from '@nestjs/common';
import { isoDate } from '@nieobecnosci/core';
import { PrismaService } from './prisma.service';
import { OrgService } from './org.service';
import { CurrentUser, type AuthUser } from './auth/current-user.decorator';

// FR-C1/C3/H1 — kalendarz zespołu (Tribe). Prezentacja JEDNOLITA: bez typu,
// bez znacznika L4 (D1/D2/H3). Ochrona L4 z konstrukcji — typ nie opuszcza serwera.
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly org: OrgService,
  ) {}

  @Get()
  async get(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const fromD = from ? new Date(from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const toD = to ? new Date(to) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    const peers = await this.org.tribePeers(user.sub);
    const absences = await this.prisma.absence.findMany({
      where: { employeeId: { in: peers }, dateFrom: { lte: toD }, dateTo: { gte: fromD } },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: [{ dateFrom: 'asc' }],
    });

    return absences.map((a) => ({
      employeeId: a.employeeId,
      employee: `${a.employee.firstName} ${a.employee.lastName}`,
      dateFrom: isoDate(a.dateFrom),
      dateTo: isoDate(a.dateTo),
      dayPart: a.dayPart,
    }));
  }
}
