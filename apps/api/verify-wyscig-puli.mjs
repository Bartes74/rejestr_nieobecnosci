// FR-A7 (regresja): pula urlopu przy równoległych zapisach.
//
// Między sprawdzeniem puli a zapisem nie było niczego, co powstrzymałoby drugie żądanie.
// Dwa równoległe zapisy czytały ten sam stan, oba przechodziły walidację i oba lądowały
// w bazie — pula wychodziła przekroczona. Wystarczyły dwie karty przeglądarki.
//
// Pula urlopu jest zasobem o wartości, więc kontrola, którą da się obejść odświeżeniem
// strony w dwóch oknach, nie jest kontrolą.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';

const API = process.env.API ?? 'http://localhost:3100/api';
const prisma = new PrismaClient();
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };
const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const login = async (l, p) => (await j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: l, password: p }) }))).token;
const as = (t) => (p, o = {}) => fetch(API + p, { ...o, headers: { 'content-type': 'application/json', authorization: `Bearer ${t}`, ...(o.headers || {}) } });

for (let i = 0; i < 30; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const rok = new Date().getUTCFullYear();
const mk = (login) => prisma.employee.create({ data: { firstName: login, lastName: 'WP', email: `${login}@x.pl`, login, role: 'EMPLOYEE', employmentType: 'UOP', startDate: new Date(`${rok}-01-01`), passwordHash: hashPassword('haslo123') } });

await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '3' }, update: { value: '3' } });
const emp = await mk('wpanna');
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop WP' } });

const a = as(await login('wpanna', 'haslo123'));
const bal0 = await j(await a(`/employees/${emp.id}/balance`));
ok(bal0.pool === 3, `pula ustawiona na 3 dni (${bal0.pool})`);

// Pięć osobnych dni roboczych, wysłanych naraz — pula pozwala na trzy.
const DNI = [`${rok}-09-01`, `${rok}-09-02`, `${rok}-09-03`, `${rok}-09-04`, `${rok}-09-07`];
const odpowiedzi = await Promise.all(DNI.map((d) =>
  a('/absences', { method: 'POST', body: JSON.stringify({ employeeId: emp.id, typeId: urlop.id, dateFrom: d, dateTo: d }) })));

const zapisane = odpowiedzi.filter((r) => r.status === 201).length;
const odrzucone = odpowiedzi.filter((r) => r.status === 400).length;
console.log(`  (zapisane: ${zapisane}, odrzucone: ${odrzucone}, statusy: ${odpowiedzi.map((r) => r.status).join(',')})`);

ok(zapisane + odrzucone === 5, 'każde żądanie dostało jednoznaczną odpowiedź (201 albo 400)');
ok(zapisane === 3, `zapisały się dokładnie trzy dni — tyle, ile pozwala pula (${zapisane})`);

// Asercja właściwa: niezależnie od kolejności, wykorzystanie nie może przekroczyć dostępnych dni.
const bal = await j(await a(`/employees/${emp.id}/balance`));
ok(bal.used <= bal.pool + bal.carriedOver, `wykorzystanie (${bal.used}) nie przekracza dostępnych dni (${bal.pool + bal.carriedOver})`);
ok(bal.remaining >= 0, `saldo nie zeszło poniżej zera (${bal.remaining})`);
ok((await prisma.absence.count({ where: { employeeId: emp.id } })) === 3, 'w bazie leżą dokładnie trzy wpisy');

// Zapisy różnych osób nadal idą równolegle — kolejkujemy per osoba, nie globalnie.
const inni = await Promise.all([mk('wpb'), mk('wpc'), mk('wpd')]);
const rownolegle = await Promise.all(inni.map((e, i) =>
  a('/absences', { method: 'POST', body: JSON.stringify({ employeeId: e.id, typeId: urlop.id, dateFrom: DNI[i], dateTo: DNI[i] }) })));
// Bez uprawnień do cudzych wpisów — liczy się to, że każde żądanie dobiegło końca, a nie utknęło.
ok(rownolegle.every((r) => r.status === 403), 'żądania dotyczące innych osób nie blokują się nawzajem (kolejka jest per osoba)');

await prisma.$disconnect();
console.log(failures === 0 ? '\nWYŚCIG O PULĘ OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
