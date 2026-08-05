// Domknięcie MVP: FR-H4 (role + nadawanie/odbieranie uprawnień) + FR-J2 (retencja/anonimizacja).
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

const mk = (login, role, extra = {}) => prisma.employee.create({ data: { firstName: login, lastName: 'HJ', email: `${login}@x.pl`, login, role, employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123'), ...extra } });
await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop HJ' } });
const admin = await mk('hjadmin', 'ADMIN');
const bob = await mk('hjbob', 'EMPLOYEE');
const alice = await mk('hjalice', 'EMPLOYEE');
const former = await mk('hjformer', 'EMPLOYEE', { endDate: new Date('2022-01-01') }); // odszedł 4 lata temu

const aAdmin = as(await login('hjadmin', 'haslo123'));
const mkAbs = (t, eid, day) => as(t)('/absences', { method: 'POST', body: JSON.stringify({ employeeId: eid, typeId: urlop.id, dateFrom: `2026-06-${day}`, dateTo: `2026-06-${day}` }) });

// --- FR-H4: nadawanie uprawnień ---
ok((await mkAbs(await login('hjbob', 'haslo123'), alice.id, '08')).status === 403, 'bez uprawnień: bob nie wpisuje cudzej → 403');
const perms = await j(await aAdmin(`/employees/${bob.id}/permissions`, { method: 'POST', body: JSON.stringify({ scope: 'MODIFY_ABSENCE' }) }));
ok(perms.includes('MODIFY_ABSENCE'), 'admin nadał MODIFY_ABSENCE');
ok((await mkAbs(await login('hjbob', 'haslo123'), alice.id, '08')).ok, 'po nadaniu (i re-login): bob wpisuje cudzą → ok');
await j(await aAdmin(`/employees/${bob.id}/permissions/MODIFY_ABSENCE`, { method: 'DELETE' }));
ok((await mkAbs(await login('hjbob', 'haslo123'), alice.id, '09')).status === 403, 'po odebraniu: bob znów nie wpisuje → 403');

// rola
const r = await j(await aAdmin(`/employees/${bob.id}/role`, { method: 'PATCH', body: JSON.stringify({ role: 'LEADER' }) }));
ok(r.role === 'LEADER', 'admin zmienił rolę bob → LEADER');
ok((await as(await login('hjbob', 'haslo123'))(`/employees/${alice.id}/permissions`, { method: 'POST', body: JSON.stringify({ scope: 'VIEW_L4' }) })).status === 403, 'nie-admin nie nadaje uprawnień → 403');

// --- FR-J2: retencja + anonimizacja ---
const ret = await j(await aAdmin('/retention/run', { method: 'POST' }));
ok(ret.anonymized >= 1, `retencja zanonimizowała byłych pracowników (${ret.anonymized})`);
const f = await prisma.employee.findUnique({ where: { id: former.id } });
ok(f.login.startsWith('anon-') && f.firstName === 'Pracownik' && !f.passwordHash, 'były pracownik zanonimizowany (PII usunięte)');
const an = await j(await aAdmin(`/employees/${alice.id}/anonymize`, { method: 'POST' }));
ok(an.anonymized === true, 'anonimizacja na żądanie (prawo do bycia zapomnianym)');

await prisma.$disconnect();
console.log(failures === 0 ? '\nMVP H4 + J2 OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
