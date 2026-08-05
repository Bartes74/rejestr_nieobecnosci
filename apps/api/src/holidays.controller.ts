import { Body, Controller, Get, Post, Query } from '@nestjs/common';
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

  @Roles('ADMIN')
  @Post('holidays')
  createHoliday(@Body() dto: CreateHolidayDto) {
    return this.prisma.holiday.create({
      data: { name: dto.name, date: new Date(dto.date), calendarId: dto.calendarId },
    });
  }
}
