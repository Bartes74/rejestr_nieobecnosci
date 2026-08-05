import { Controller, Get, Header, NotFoundException, Query } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { toICS, type ICalEvent } from '@nieobecnosci/core';
import { PrismaService } from './prisma.service';
import { OrgService } from './org.service';
import { Public } from './auth/decorators';
import { CurrentUser, type AuthUser } from './auth/current-user.decorator';

// FR-F4 — subskrybowalne kanały iCal. Klienty kalendarza (Outlook/Google) nie wysyłają nagłówka Bearer,
// więc uwierzytelnienie idzie przez losowy token per-user w query (?token=...), odwoływalny przez regenerację.
// Kanał zespołu jest JEDNOLITY (bez typu — L4 niewyróżniane, D2/H3); własny może mieć typy (to dane usera).
@Controller()
export class CalendarFeedController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly org: OrgService,
  ) {}

  // Token subskrypcji bieżącego użytkownika (tworzony leniwie przy pierwszym żądaniu). Regeneracja unieważnia stare linki.
  @Get('me/feed-token')
  async myToken(@CurrentUser() user: AuthUser, @Query('regenerate') regenerate?: string) {
    let emp = await this.prisma.employee.findUnique({ where: { id: user.sub } });
    if (!emp?.feedToken || regenerate === 'true') {
      emp = await this.prisma.employee.update({ where: { id: user.sub }, data: { feedToken: randomBytes(24).toString('hex') } });
    }
    return { token: emp.feedToken };
  }

  @Public()
  @Get('feed/me.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async meFeed(@Query('token') token: string) {
    const emp = token ? await this.prisma.employee.findUnique({ where: { feedToken: token } }) : null;
    if (!emp) throw new NotFoundException();
    const abs = await this.prisma.absence.findMany({ where: { employeeId: emp.id }, include: { type: true }, orderBy: { dateFrom: 'asc' } });
    const events: ICalEvent[] = abs.map((a) => ({ uid: `${a.id}@nieobecnosci`, summary: a.type.name, dateFrom: a.dateFrom, dateTo: a.dateTo }));
    return toICS(events, 'Moje nieobecności');
  }

  @Public()
  @Get('feed/team.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async teamFeed(@Query('token') token: string) {
    const emp = token ? await this.prisma.employee.findUnique({ where: { feedToken: token } }) : null;
    if (!emp) throw new NotFoundException();
    const peers = await this.org.tribePeers(emp.id);
    const abs = await this.prisma.absence.findMany({
      where: { employeeId: { in: peers } },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { dateFrom: 'asc' },
    });
    // Jednolicie — typ NIE opuszcza serwera (jak calendar.controller.ts).
    const events: ICalEvent[] = abs.map((a) => ({ uid: `${a.id}@nieobecnosci`, summary: `Nieobecność – ${a.employee.firstName} ${a.employee.lastName}`, dateFrom: a.dateFrom, dateTo: a.dateTo }));
    return toICS(events, 'Kalendarz zespołu');
  }
}
