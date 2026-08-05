import {
  Body, Controller, Get, Post, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SprintsService } from './sprints.service';
import { CreateSprintDto } from './dto';
import { parseMapping } from './import-mapping';
import { Roles } from './auth/decorators';

@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get()
  list() {
    return this.sprints.list();
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateSprintDto) {
    return this.sprints.create(dto);
  }

  // Opcjonalne pole "mapping" (JSON) nadpisuje nazwy kolumn (konfigurowalne mapowanie nagłówków).
  @Roles('ADMIN')
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } })) // M2 — limit DoS
  import(@UploadedFile() file: { buffer: Buffer }, @Body('mapping') mapping?: string) {
    return this.sprints.importXlsx(file.buffer, parseMapping(mapping));
  }
}
