// Odczyt arkusza po NAZWIE nagłówka — wspólny dla obu importów (pracownicy FR-G5, sprinty FR-D4).
// Wcześniej każdy z nich miał własną kopię tej pętli; sklejenie ich w `readSheet` znaczy, że
// literówka w indeksowaniu psuje teraz oba naraz, a nie jeden.
//
// Suita bez bazy i bez API: `readSheet` dostaje bufor i oddaje komórki, więc sprawdza się ją
// samym plikiem zbudowanym w pamięci.
import ExcelJS from 'exceljs';
import { readSheet } from './dist/xlsx.js';

let failures = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };

const plik = async (rows) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Arkusz');
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
};

// Kolumny celowo w innej kolejności niż domyślne mapowanie: wiąże nagłówek, nie pozycja.
const { ws, cell } = await readSheet(await plik([
  ['Squad', 'Sprint', 'Od'],
  ['Alfa', 'S-1', '2026-09-07'],
  ['', 'S-2', '2026-09-21'],
]));

ok(ws.rowCount === 3, 'arkusz ma nagłówek i dwa wiersze danych');
ok(cell(ws.getRow(2), 'Sprint') === 'S-1', 'komórka po nazwie nagłówka, nie po numerze kolumny');
ok(cell(ws.getRow(2), 'Squad') === 'Alfa', 'kolumna spoza domyślnej kolejności czyta się poprawnie');
ok(cell(ws.getRow(3), 'Squad') === '', 'pusta komórka to pusty łańcuch, nie „null"');
// Bez tego literówka w mapowaniu nagłówków leciałaby dalej jako `undefined` i wywracała
// walidację wiersza w miejscu, które o mapowaniu nic nie wie.
ok(cell(ws.getRow(2), 'Nie ma takiej') === '', 'nieznany nagłówek daje pusty łańcuch, nie wyjątek');

// Nagłówki bywają wpisane z wleczącą spacją — plik zamawiającego nie jest pod niczyją kontrolą.
const { ws: ws2, cell: cell2 } = await readSheet(await plik([['  Sprint  '], ['S-9']]));
ok(cell2(ws2.getRow(2), 'Sprint') === 'S-9', 'spacje wokół nagłówka nie psują dopasowania');

// Plik bez arkusza to błąd wejścia (400), nie awaria serwera (500).
const pusty = new ExcelJS.Workbook();
try {
  await readSheet(Buffer.from(await pusty.xlsx.writeBuffer()));
  ok(false, 'plik bez arkusza odrzucony jako błąd wejścia');
} catch (e) {
  ok(e?.getStatus?.() === 400, 'plik bez arkusza odrzucony jako błąd wejścia (400)');
}

console.log(failures ? `\n❌ ${failures} nieudanych` : '\n✅ readSheet OK');
process.exit(failures ? 1 : 0);
