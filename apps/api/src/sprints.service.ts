import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from './prisma.service';
import { CreateSprintDto } from './dto';
import { isoRange } from './serialize';

// Domyślne mapowanie nagłówków .xlsx (układ docelowy QBR do potwierdzenia, FR-D4).
// Można je nadpisać per import (parametr `mapping`).
const COLS = { name: 'Sprint', from: 'Od', to: 'Do', squad: 'Squad' } as const;
export type SprintColMap = Partial<Record<keyof typeof COLS, string>>;

export interface SprintImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.sprint.findMany({ orderBy: { dateFrom: 'asc' }, include: { squad: true } });
    return rows.map(isoRange);
  }

  async create(dto: CreateSprintDto) {
    const created = await this.prisma.sprint.create({
      data: { name: dto.name, dateFrom: new Date(dto.dateFrom), dateTo: new Date(dto.dateTo), squadId: dto.squadId ?? null },
    });
    return isoRange(created);
  }

  // FR-D4 — import harmonogramu sprintów z .xlsx. `mapping` nadpisuje nagłówki kolumn.
  async importXlsx(buffer: Buffer, mapping?: SprintColMap): Promise<SprintImportResult> {
    const cols = { ...COLS, ...(mapping ?? {}) };
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer); // ponytail: różnica typów Buffer (jak w employees)
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('Plik nie zawiera arkusza.');

    const header: Record<string, number> = {};
    ws.getRow(1).eachCell((cell, col) => { header[String(cell.value ?? '').trim()] = col; });
    const cell = (row: ExcelJS.Row, name: string): string => {
      const c = header[name];
      return c ? String(row.getCell(c).value ?? '').trim() : '';
    };

    // squady po nazwie → id (do powiązania sprintu z jednostką)
    const squads = await this.prisma.orgUnit.findMany({ where: { type: 'SQUAD' } });
    const squadByName = new Map(squads.map((s) => [s.name.toLowerCase(), s.id]));

    const result: SprintImportResult = { created: 0, errors: [] };
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const name = cell(row, cols.name);
      if (!name) continue;
      const from = new Date(cell(row, cols.from));
      const to = new Date(cell(row, cols.to));
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
        result.errors.push({ row: r, message: 'Niepoprawny zakres dat sprintu.' });
        continue;
      }
      const squadName = cell(row, cols.squad).toLowerCase();
      await this.prisma.sprint.create({
        data: { name, dateFrom: from, dateTo: to, squadId: squadName ? squadByName.get(squadName) ?? null : null },
      });
      result.created++;
    }
    return result;
  }
}
