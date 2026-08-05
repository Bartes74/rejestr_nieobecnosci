// A5 / NFR-1 + FR-B2 — test obciążeniowy ~300 użytkowników (bez zależności: fetch + ręczna pula współbieżności).
// Doseedowuje bazę do ~300 pracowników z nieobecnościami, po czym mierzy p95 latencji 3 krytycznych endpointów:
//   pulpit  = /analytics/adoption  (NFR-1 < 2000 ms)
//   kalendarz = /calendar          (NFR-1 < 2000 ms)
//   balans  = /employees/:id/balance (FR-B2 < 1000 ms)
// Uruchom przeciw działającemu API:  API=http://localhost:3100/api node apps/api/loadtest.mjs
import { PrismaClient } from '@prisma/client';

const API = process.env.API ?? 'http://localhost:3100/api';
const TARGET = Number(process.env.LT_USERS ?? 300);   // docelowa liczba pracowników
const TOTAL = Number(process.env.LT_REQ ?? 300);      // żądań na endpoint
const CONC = Number(process.env.LT_CONC ?? 50);       // równoległość
const prisma = new PrismaClient();

const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const login = async (l, p) => (await j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: l, password: p }) }))).token;

// czekaj na API
for (let i = 0; i < 30; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

// --- doseedowanie do TARGET pracowników (idempotentne: dokłada brakujących lt-*) ---
const squad = await prisma.orgUnit.findFirst({ where: { type: 'SQUAD' } })
  ?? await prisma.orgUnit.create({ data: { name: 'LT Squad', type: 'SQUAD' } });
const urlop = await prisma.absenceType.findFirst({ where: { affectsPool: true } })
  ?? await prisma.absenceType.create({ data: { name: 'Urlop LT' } });
const have = await prisma.employee.count();
const toAdd = Math.max(0, TARGET - have);
if (toAdd > 0) {
  process.stdout.write(`Doseedowuję ${toAdd} pracowników (mam ${have}, cel ${TARGET})… `);
  for (let i = 0; i < toAdd; i++) {
    const e = await prisma.employee.create({ data: { firstName: `LT${i}`, lastName: 'Test', email: `lt${i}-${have}@lt.local`, login: `lt${i}-${have}`, role: 'EMPLOYEE', employmentType: 'UOP', startDate: new Date('2026-01-01') } });
    await prisma.orgUnitMembership.create({ data: { employeeId: e.id, orgUnitId: squad.id } });
    // część osób z nieobecnością w czerwcu, by kalendarz/zapytania miały realny wolumen
    if (i % 3 === 0) await prisma.absence.create({ data: { employeeId: e.id, typeId: urlop.id, dateFrom: new Date('2026-06-15'), dateTo: new Date('2026-06-17') } });
  }
  console.log('gotowe.');
}
const empCount = await prisma.employee.count();
const sampleIds = (await prisma.employee.findMany({ select: { id: true }, take: 50 })).map((e) => e.id);

const token = await login('admin', 'admin');
const auth = { authorization: `Bearer ${token}` };

const now = new Date();
const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

// pula żądań → URL (balans rotuje po próbce pracowników)
const endpoints = {
  pulpit: () => `${API}/analytics/adoption`,
  kalendarz: () => `${API}/calendar?from=${from}&to=${to}`,
  balans: (i) => `${API}/employees/${sampleIds[i % sampleIds.length]}/balance`,
};

async function measure(name, urlFor) {
  const lat = [];
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= TOTAL) return;
      const t0 = performance.now();
      const r = await fetch(urlFor(i), { headers: auth });
      await r.text();
      if (!r.ok) throw new Error(`${name}: ${r.status}`);
      lat.push(performance.now() - t0);
    }
  };
  const t0 = performance.now();
  await Promise.all(Array.from({ length: CONC }, worker));
  const wall = performance.now() - t0;
  lat.sort((a, b) => a - b);
  const p = (q) => lat[Math.min(lat.length - 1, Math.floor(lat.length * q))];
  return { name, n: lat.length, p50: p(0.5), p95: p(0.95), max: lat[lat.length - 1], rps: (lat.length / wall) * 1000 };
}

console.log(`\nObciążenie: ${empCount} pracowników, ${TOTAL} żądań/endpoint, współbieżność ${CONC}\n`);
let failures = 0;
const budget = { pulpit: 2000, kalendarz: 2000, balans: 1000 };
for (const [name, urlFor] of Object.entries(endpoints)) {
  const r = await measure(name, urlFor);
  const okBudget = r.p95 < budget[name];
  if (!okBudget) failures++;
  console.log(`${okBudget ? '✓' : '✗'} ${name.padEnd(10)} p50=${r.p50.toFixed(0)}ms  p95=${r.p95.toFixed(0)}ms  max=${r.max.toFixed(0)}ms  ${r.rps.toFixed(0)} req/s  (budżet p95<${budget[name]}ms)`);
}

await prisma.$disconnect();
console.log(failures === 0 ? '\nA5 / NFR-1 + FR-B2 OK ✅' : `\n${failures} ENDPOINT(ÓW) POZA BUDŻETEM ❌`);
process.exit(failures === 0 ? 0 : 1);
