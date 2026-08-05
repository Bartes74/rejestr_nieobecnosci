import { BadRequestException, Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Roles } from './auth/decorators';
import { isSettingKey, SettingsService } from './settings.service';

// FR-E3/F5/J2 — reguły administratora w jednym miejscu, zamiast wartości zaszytych w kodzie.
@Roles('ADMIN')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  all() {
    return this.settings.all();
  }

  @Put(':key')
  async set(@Param('key') key: string, @Body() body: { value?: unknown }) {
    if (!isSettingKey(key)) throw new BadRequestException('Nieznany klucz konfiguracji.');
    const value = Number(body?.value);
    if (!Number.isFinite(value) || value < 0) throw new BadRequestException('Wartość musi być liczbą nieujemną.');
    await this.settings.setNumber(key, value);
    return { key, value };
  }
}
