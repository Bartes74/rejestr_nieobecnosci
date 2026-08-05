import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Liczbowa konfiguracja administratora — reguły, które wcześniej były wartościami w kodzie.
// Wartość z bazy nadpisuje domyślną; brak wpisu = domyślna z tej tabeli.
// (Pula urlopu ma własny endpoint /pools/default — FR-B3 — i celowo nie jest tu duplikowana.)
export const NUMERIC_SETTINGS = {
  'retention.months': { def: 24, label: 'Okres przechowywania danych byłych pracowników (miesiące)', ref: 'FR-J2' },
  'overdue.threshold': { def: 10, label: 'Próg zalegania: od ilu pozostałych dni raport wskazuje osobę', ref: 'FR-F5' },
  'reminder.minCarriedOver': { def: 1, label: 'Przypomnienie o zaległym urlopie: od ilu dni zaległych wysyłać', ref: 'FR-E3' },
} as const;

export type SettingKey = keyof typeof NUMERIC_SETTINGS;
export const isSettingKey = (k: string): k is SettingKey => Object.hasOwn(NUMERIC_SETTINGS, k);

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Wartość liczbowa ustawienia; uszkodzony lub brakujący wpis → wartość domyślna. */
  async getNumber(key: SettingKey): Promise<number> {
    const row = await this.prisma.adminSetting.findUnique({ where: { key } });
    const n = row ? Number(row.value) : Number.NaN;
    return Number.isFinite(n) ? n : NUMERIC_SETTINGS[key].def;
  }

  async all(): Promise<{ key: SettingKey; value: number; label: string; ref: string }[]> {
    const rows = await this.prisma.adminSetting.findMany({ where: { key: { in: Object.keys(NUMERIC_SETTINGS) } } });
    const stored = new Map(rows.map((r) => [r.key, Number(r.value)]));
    return (Object.keys(NUMERIC_SETTINGS) as SettingKey[]).map((key) => {
      const v = stored.get(key);
      const meta = NUMERIC_SETTINGS[key];
      return { key, value: v !== undefined && Number.isFinite(v) ? v : meta.def, label: meta.label, ref: meta.ref };
    });
  }

  setNumber(key: SettingKey, value: number) {
    const v = String(value);
    return this.prisma.adminSetting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
  }
}
