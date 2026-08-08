import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { polishHolidays } from '@nieobecnosci/core';
import { PrismaService } from './prisma.service';
import { CreateCalendarDto, CreateHolidayDto } from './dto';
import { Roles } from './auth/decorators';

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
  holidays(@Query('calendarId') calendarId?: string) {
    return this.prisma.holiday.findMany({
      where: calendarId ? { calendarId } : undefined,
      orderBy: { date: 'asc' },
    });
  }

  // Święta ustawowe są wyliczane (packages/core), nie pobierane z zewnątrz — wdrożenie jest
  // on-prem. `skipDuplicates` opiera się na unikalności (calendarId, date), więc powtórny import
  // tego samego roku nic nie psuje ani nie nadpisuje dni dodanych ręcznie.
  @Roles('ADMIN')
  @Post('holiday-calendars/:id/import-pl')
  async importPolish(@Param('id') calendarId: string, @Query('year') year?: string) {
    const y = Number(year) || new Date().getUTCFullYear();
    const { count } = await this.prisma.holiday.createMany({
      data: polishHolidays(y).map((h) => ({ ...h, calendarId })),
      skipDuplicates: true,
    });
    return { year: y, added: count };
  }

  @Roles('ADMIN')
  @Post('holidays')
  createHoliday(@Body() dto: CreateHolidayDto) {
    return this.prisma.holiday.create({
      data: { name: dto.name, date: new Date(dto.date), calendarId: dto.calendarId },
    });
  }
}
