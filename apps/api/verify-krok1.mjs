// Smoke test Kroku 1: config admina + import .xlsx (domyślne mapowanie kolumn) + balans liczony przez core.
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';

const API = process.env.API ?? 'http://localhost:3100/api';
const prisma = new PrismaClient();
let failures = 0;
let token = '';
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };
const j = async (res) => { if (!res.ok) throw new Error(`${res.status} ${await res.text()}`); return res.json(); };
const H = () => ({ 'content-type': 'application/json', authorization: `Bearer ${token}` });
const HF = () => ({ authorization: `Bearer ${token}` }); // multipart — bez content-type

// czekaj na API
for (let i = 0; i < 30; i++) {
  try { const r = await fetch(`${API}/health`); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
ok((await fetch(`${API}/health`)).ok, 'GET /health → ok');

// API jest zabezpieczone RBAC (od Kroku 3) — bootstrap admina + token.
await prisma.employee.create({ data: { firstName: 'Adm', lastName: 'K1', email: 'admin@k1.pl', login: 'k1admin', role: 'ADMIN', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
token = (await j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: 'k1admin', password: 'haslo123' }) }))).token;

// FR-G1 — typy nieobecności
const urlop = await j(await fetch(`${API}/absence-types`, { method: 'POST', headers: H(), body: JSON.stringify({ name: 'Nieobecność' }) }));
const l4 = await j(await fetch(`${API}/absence-types`, { method: 'POST', headers: H(), body: JSON.stringify({ name: 'L4', affectsPool: false, specialCategory: true }) }));
ok(urlop.affectsPool === true && l4.affectsPool === false && l4.specialCategory === true, 'POST /absence-types → urlop (pula) + L4 (bez puli, special)');

// FR-G2 — pula globalna
await j(await fetch(`${API}/pools/default`, { method: 'PUT', headers: H(), body: JSON.stringify({ value: 26 }) }));
const def = await j(await fetch(`${API}/pools/default`, { headers: H() }));
ok(def.value === 26, 'PUT /pools/default → 26');

// FR-G5 — import .xlsx, DOMYŚLNE nagłówki (1 poprawny UoP, 1 błędna forma → raport błędu)
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Pracownicy');
ws.addRow(['Imię', 'Nazwisko', 'E-mail', 'Login', 'Forma', 'Data startu']);
ws.addRow(['Anna', 'Kowalska', 'anna.kowalska@firma.example', 'akowalska', 'UoP', '2026-01-01']);
ws.addRow(['Jan', 'Nowak', 'jan.nowak@firma.example', 'jnowak', 'ETAT', '2026-01-01']); // zła forma
const xlsx = await wb.xlsx.writeBuffer();
const fd = new FormData();
fd.append('file', new Blob([xlsx]), 'pracownicy.xlsx');
const imp = await j(await fetch(`${API}/employees/import`, { method: 'POST', headers: HF(), body: fd }));
ok(imp.created === 1 && imp.errors.length === 1 && imp.errors[0].row === 3, `import (domyślne mapowanie) → utworzono 1, błąd w wierszu 3 (forma "ETAT")`);

// pobierz utworzonego pracownika (lista zawiera też admina — filtrujemy po e-mailu)
const anna = (await j(await fetch(`${API}/employees`, { headers: H() }))).find((e) => e.email === 'anna.kowalska@firma.example');
ok(anna?.employmentType === 'UOP', 'GET /employees → Anna (UoP)');

// dodaj nieobecności: 5 dni urlopu + 3 dni L4 (L4 nie obniża puli — FR-B5)
await prisma.absence.create({ data: { employeeId: anna.id, typeId: urlop.id, dateFrom: new Date('2026-06-22'), dateTo: new Date('2026-06-26') } });
await prisma.absence.create({ data: { employeeId: anna.id, typeId: l4.id, dateFrom: new Date('2026-07-01'), dateTo: new Date('2026-07-03') } });

// FR-B1/B2/B5 — balans liczony przez core
const bal = await j(await fetch(`${API}/employees/${anna.id}/balance`, { headers: H() }));
console.log('  balans:', JSON.stringify(bal));
ok(bal.period.type === 'CALENDAR' && bal.period.year === 2026, 'balans: okres kalendarzowy 2026 (UoP)');
ok(bal.used === 5, 'balans: wykorzystano 5 dni (L4 pominięte)');
ok(bal.remaining === 21, 'balans: pozostało 21 (26 − 5; L4 nie obniża puli)');

await prisma.$disconnect();
console.log(failures === 0 ? '\nKROK 1 OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
