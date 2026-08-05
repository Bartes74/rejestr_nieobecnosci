// Smoke test Kroku 6 (NFR-5): rejestrowanie zdarzeń bezpieczeństwa w AuditLog.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';

const API = process.env.API ?? 'http://localhost:3100/api';
const prisma = new PrismaClient();
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };
const post = (p, b, t) => fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify(b) });
const login = async (l, p) => { const r = await post('/auth/login', { login: l, password: p }); return r.ok ? (await r.json()).token : null; };

for (let i = 0; i < 30; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const worker = await prisma.employee.create({ data: { firstName: 'K6', lastName: 'Worker', email: 'k6worker@x.pl', login: 'k6worker', role: 'EMPLOYEE', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });

// --- nieudane logowanie → LOGIN_FAILED ---
ok((await post('/auth/login', { login: 'k6ghost', password: 'bad' })).status === 401, 'nieudane logowanie → 401');
ok(!!(await prisma.auditLog.findFirst({ where: { action: 'LOGIN_FAILED', description: { contains: 'k6ghost' } } })), 'LOGIN_FAILED zapisane w audycie');

// --- odmowa dostępu wg roli → ACCESS_DENIED ---
const wt = await login('k6worker', 'haslo123');
ok((await post('/absence-types', { name: 'X' }, wt)).status === 403, 'pracownik na trasie admina → 403');
ok(!!(await prisma.auditLog.findFirst({ where: { action: 'ACCESS_DENIED', userId: worker.id } })), 'ACCESS_DENIED zapisane w audycie');

await prisma.$disconnect();
console.log(failures === 0 ? '\nKROK 6 (NFR-5) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
