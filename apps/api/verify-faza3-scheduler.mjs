// B1 / FR-E3 + FR-J2 — scheduler deleguje do istniejących operacji: przypomnienia o zaległym urlopie
// i retencja (anonimizacja byłych pracowników). Testujemy logikę przez endpointy manualne (cron woła to samo).
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

const mk = (lg, role, extra = {}) => prisma.employee.create({ data: { firstName: lg, lastName: 'SCH', email: `${lg}@sch.pl`, login: lg, role, employmentType: 'UOP', startDate: new Date('2020-01-01'), passwordHash: hashPassword('haslo123'), ...extra } });
await mk('schadmin', 'ADMIN');
const zalega = await mk('schzalega', 'EMPLOYEE');
await prisma.leaveAllowance.create({ data: { employeeId: zalega.id, periodYear: 2026, baseDays: 26, carriedOver: 5 } }); // FR-E3: zaległy urlop

// FR-J2: były pracownik po okresie retencji (endDate 26 mies. temu > domyślne 24 mies.)
const past = new Date(); past.setUTCMonth(past.getUTCMonth() - 26);
const odszedl = await mk('schodszedl', 'EMPLOYEE', { endDate: past });

const aAdmin = as(await login('schadmin', 'haslo123'));

// FR-E3 — przypomnienia (to woła @Cron dailyReminders)
const rem = await j(await aAdmin('/notifications/overdue-reminders', { method: 'POST' }));
ok(rem.sent >= 1, `przypomnienia o zaległym urlopie wysłane (sent=${rem.sent})`);

// FR-J2 — retencja (to woła @Cron dailyRetention)
const ret = await j(await aAdmin('/retention/run', { method: 'POST' }));
ok(ret.anonymized >= 1 && ret.months === 24, `retencja zanonimizowała byłego pracownika (anonymized=${ret.anonymized}, okres=${ret.months})`);
const after = await prisma.employee.findUnique({ where: { id: odszedl.id } });
ok(after?.login?.startsWith('anon-'), 'były pracownik faktycznie zanonimizowany (login anon-*)');
ok(!!(await prisma.auditLog.findFirst({ where: { action: 'ANONYMIZE', entityId: odszedl.id } })), 'anonimizacja odnotowana w audycie (FR-J2)');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 3 (scheduler: przypomnienia + retencja) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
