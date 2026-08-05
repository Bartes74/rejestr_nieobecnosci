import { Body, Controller, Get, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Roles } from './auth/decorators';
import { CreateProcessingActivityDto } from './dto';

// FR-J3 — rejestr czynności przetwarzania (RODO, art. 30). Dostępny dla administratora/IOD.
@Roles('ADMIN')
@Controller('processing-register')
export class ProcessingRegisterController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.processingActivity.findMany({ orderBy: { name: 'asc' } });
  }

  @Post()
  create(@Body() dto: CreateProcessingActivityDto) {
    return this.prisma.processingActivity.create({ data: dto });
  }
}
