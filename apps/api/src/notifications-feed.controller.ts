import { Controller, Get } from '@nestjs/common';
import { isoDate } from '@nieobecnosci/core';
import { PrismaService } from './prisma.service';
import { BalanceService } from './balance.service';
import { CapacityService } from './capacity.service';
import { CurrentUser, type AuthUser } from './auth/current-user.decorator';

interface FeedItem { kind: string; text: string; severity: 'info' | 'warning' | 'danger'; }
const dm = (iso: string) => `${Number(iso.slice(8, 10))}.${iso.slice(5, 7)}`;

// B4 — powiadomienia in-app: wyliczane z istniejących sygnałów (bez tabeli, bez stanu read/unread).
// L4-safe: tylko daty/liczby/nazwy jednostek — nigdy typ nieobecności.
@Controller('notifications')
export class NotificationsFeedController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly capacity: CapacityService,
  ) {}

  @Get('feed')
  async feed(@CurrentUser() user: AuthUser) {
    const items: FeedItem[] = [];
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const in7 = new Date(today.getTime() + 7 * 86_400_000);

    // 1) zaległy urlop (FR-E3)
    const bal = await this.balance.current(user.sub).catch(() => null);
    if (bal && bal.carriedOver > 0) {
      items.push({ kind: 'overdue', text: `Masz ${bal.carriedOver} dni zaległego urlopu — zaplanuj wykorzystanie.`, severity: 'warning' });
    }

    // 2) nadchodzące własne nieobecności (≤7 dni)
    const upcoming = await this.prisma.absence.findMany({
      where: { employeeId: user.sub, dateFrom: { gte: today, lte: in7 } },
      orderBy: { dateFrom: 'asc' },
    });
    for (const a of upcoming) {
      items.push({ kind: 'upcoming', text: `Zbliża się Twoja nieobecność ${dm(isoDate(a.dateFrom))}.`, severity: 'info' });
    }

    // 3) lider: kolizje ról kluczowych w bieżącym sprincie (FR-D3) — bez typu, tylko jednostka + daty
    if (user.role === 'LEADER') {
      const sprint = await this.prisma.sprint.findFirst({ where: { dateFrom: { lte: today }, dateTo: { gte: today } } });
      if (sprint) {
        const myUnits = await this.prisma.orgUnitMembership.findMany({ where: { employeeId: user.sub }, include: { orgUnit: true } });
        for (const m of myUnits.filter((u) => u.orgUnit.type === 'SQUAD')) {
          const cap = await this.capacity.forSprint(sprint.id, m.orgUnitId).catch(() => null);
          for (const c of cap?.keyRoleCollisions ?? []) {
            items.push({ kind: 'collision', text: `Kolizja ról kluczowych w „${m.orgUnit.name}" (${dm(c.dateFrom)}–${dm(c.dateTo)}).`, severity: 'danger' });
          }
        }
      }
    }

    return { items, count: items.length };
  }
}
