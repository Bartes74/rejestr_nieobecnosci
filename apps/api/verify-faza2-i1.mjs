// Faza 2: FR-I1 — pełna historia zmian wpisu (dodanie/edycja/usunięcie) w niezmiennym dzienniku, per wpis.
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

await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop I1' } });
const admin = await prisma.employee.create({ data: { firstName: 'Adm', lastName: 'I1', email: 'i1admin@x.pl', login: 'i1admin', role: 'ADMIN', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const anna = await prisma.employee.create({ data: { firstName: 'Anna', lastName: 'I1', email: 'i1anna@x.pl', login: 'i1anna', role: 'EMPLOYEE', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });

const aAnna = as(await login('i1anna', 'haslo123'));
const aAdmin = as(await login('i1admin', 'haslo123'));

// dodanie → edycja → usunięcie
const abs = await j(await aAnna('/absences', { method: 'POST', body: JSON.stringify({ employeeId: anna.id, typeId: urlop.id, dateFrom: '2026-06-08', dateTo: '2026-06-08' }) }));
await j(await aAnna(`/absences/${abs.id}`, { method: 'PATCH', body: JSON.stringify({ dateTo: '2026-06-09' }) }));
await j(await aAnna(`/absences/${abs.id}`, { method: 'DELETE' }));

// historia per wpis (admin filtruje audyt po entityId)
const hist = await j(await aAdmin(`/audit?entity=Absence&entityId=${abs.id}`));
const actions = hist.map((h) => h.action);
ok(actions.includes('ABSENCE_CREATE'), 'historia: dodanie zapisane');
ok(actions.includes('ABSENCE_UPDATE'), 'historia: edycja zapisana');
ok(actions.includes('ABSENCE_DELETE'), 'historia: usunięcie zapisane');
ok(hist.every((h) => h.userId === anna.id && h.timestamp), 'każdy wpis ma użytkownika i znacznik czasu');
ok(hist.length === 3, 'pełna historia 3 operacji per wpis');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 2 (historia zmian) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
