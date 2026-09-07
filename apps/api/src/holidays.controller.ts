import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { polishHolidays, todayUtc } from '@nieobecnosci/core';
import { PrismaService } from './prisma.service';
import { CreateCalendarDto, CreateHolidayDto } from './dto';
import { Roles } from './auth/decorators';
import { isoDay } from './serialize';

/** Import świąt ustawowych PL za rok; idempotentny dzięki unikalności (calendarId, date). */
export async function importPolishHolidays(prisma: PrismaService, calendarId: string, year: number): Promise<number> {
  const { count } = await prisma.holiday.createMany({
    data: polishHolidays(year).map((h) => ({ ...h, calendarId })),
    skipDuplicates: true,
  });
  return count;
}

/**
 * Kalendarz domyślny ma mieć święta na bieżący i następny rok — wołane co noc ze schedulera
 * i ręcznie z API. Wcześniej import był wyłącznie ręczny, per rok: na instancji zleceniodawcy
 * kalendarz istniał, ale był pusty, i 11 listopada liczył się jako dzień pracy.
 */
export async function ensureDefaultPolishHolidays(prisma: PrismaService): Promise<{ calendarId: string; added: number } | null> {
  const cal = await prisma.holidayCalendar.findFirst({ where: { isDefault: true } });
  if (!cal) return null;
  const y = todayUtc().getUTCFullYear();
  let added = 0;
  for (const year of [y, y + 1]) added += await importPolishHolidays(prisma, cal.id, year);
  return { calendarId: cal.id, added };
}

// FR-G3/G7 — kalendarze świąt i dni wolne (pomijane przy liczeniu).
@Controller()
export class HolidaysController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('holiday-calendars')
  calendars() {
    return this.prisma.holidayCalendar.findMany({
      include: { _count: { select: { holidays: true } } },
      orderBy: { name: 'asc' },
    });
  }

  @Roles('ADMIN')
  @Post('holiday-calendars')
  createCalendar(@Body() dto: CreateCalendarDto) {
    return this.prisma.holidayCalendar.create({ data: dto });
  }

  @Get('holidays')
  async holidays(@Query('calendarId') calendarId?: string) {
    const rows = await this.prisma.holiday.findMany({
      where: calendarId ? { calendarId } : undefined,
      orderBy: { date: 'asc' },
    });
    return rows.map(isoDay);
  }

  // Święta ustawowe są wyliczane (packages/core), nie pobierane z zewnątrz — wdrożenie jest
  // on-prem. `skipDuplicates` opiera się na unikalności (calendarId, date), więc powtórny import
  // tego samego roku nic nie psuje ani nie nadpisuje dni dodanych ręcznie.
  @Roles('ADMIN')
  @Post('holiday-calendars/:id/import-pl')
  async importPolish(@Param('id') calendarId: string, @Query('year') year?: string) {
    // `todayUtc()`, nie `new Date()`: o 23:30 UTC 31 grudnia w Warszawie jest już 1 stycznia,
    // a surowy rok UTC podstawiłby tu rok poprzedni (ten sam błąd co w licznikach balansu).
    const y = Number(year) || todayUtc().getUTCFullYear();
    return { year: y, added: await importPolishHolidays(this.prisma, calendarId, y) };
  }

  // Ręczny odpowiednik nocnego zadania schedulera — dla administratora i dla suit integracyjnych.
  @Roles('ADMIN')
  @Post('holiday-calendars/default/ensure-pl')
  async ensureDefault() {
    const r = await ensureDefaultPolishHolidays(this.prisma);
    if (!r) throw new NotFoundException('Brak kalendarza domyślnego.');
    return r;
  }

  @Roles('ADMIN')
  @Post('holidays')
  async createHoliday(@Body() dto: CreateHolidayDto) {
    const created = await this.prisma.holiday.create({
      data: { name: dto.name, date: new Date(dto.date), calendarId: dto.calendarId },
    });
    return isoDay(created);
  }
}
