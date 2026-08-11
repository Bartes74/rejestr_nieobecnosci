import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

/**
 * Pierwszy arkusz wgranego pliku plus odczyt komórki po NAZWIE nagłówka, nie po numerze kolumny.
 * Oba importy (pracownicy FR-G5, sprinty FR-D4) dopuszczają własne mapowanie nagłówków, więc
 * kolejność kolumn w pliku zamawiającego jest z góry nieznana — wiąże nagłówek, nie pozycja.
 *
 * Nieznany nagłówek daje pusty łańcuch zamiast wyjątku: każdy import i tak sprawdza wiersz po
 * swojemu i umie powiedzieć, czego w nim brakuje, a wyjątek stąd zatrzymałby cały plik na
 * pierwszej literówce w mapowaniu.
 */
export async function readSheet(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  // ponytail: cast łata różnicę typów (Buffer generyczny w @types/node 22 vs typy exceljs); runtime OK.
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new BadRequestException('Plik nie zawiera arkusza.');

  const column: Record<string, number> = {};
  ws.getRow(1).eachCell((c, col) => { column[String(c.value ?? '').trim()] = col; });
  const cell = (row: ExcelJS.Row, header: string): string => {
    const col = column[header];
    return col ? String(row.getCell(col).value ?? '').trim() : '';
  };

  return { ws, cell };
}
