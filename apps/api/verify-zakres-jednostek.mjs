// FR-H1/H2 — lista jednostek musi zgadzać się z assertUnitInScope: każda jednostka pokazana
// użytkownikowi ma być przez API akceptowana, żeby picker w UI nie oferował wyborów kończących się 403.
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

// Struktura: Pion ZJ › Departament ZJ › { Tribe ZJ-A (2 squady), Tribe ZJ-B (1 squad) }
const pion = await prisma.orgUnit.create({ data: { name: 'Pion ZJ', type: 'PION' } });
const dept = await prisma.orgUnit.create({ data: { name: 'Departament ZJ', type: 'DEPARTAMENT', parentId: pion.id } });
const tribeA = await prisma.orgUnit.create({ data: { name: 'Tribe ZJ-A', type: 'TRIBE', parentId: dept.id } });
const tribeB = await prisma.orgUnit.create({ data: { name: 'Tribe ZJ-B', type: 'TRIBE', parentId: dept.id } });
const squadA1 = await prisma.orgUnit.create({ data: { name: 'Squad ZJ-A1', type: 'SQUAD', parentId: tribeA.id } });
const squadA2 = await prisma.orgUnit.create({ data: { name: 'Squad ZJ-A2', type: 'SQUAD', parentId: tribeA.id } });
const squadB1 = await prisma.orgUnit.create({ data: { name: 'Squad ZJ-B1', type: 'SQUAD', parentId: tribeB.id } });

await prisma.adminSetting.upsert({ where: { key: 'leavePool.default' }, create: { key: 'leavePool.default', value: '26' }, update: { value: '26' } });
const mk = (login, role) => prisma.employee.create({ data: { firstName: login, lastName: 'ZJ', email: `${login}@x.pl`, login, role, employmentType: 'UOP', startDate: new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)), passwordHash: hashPassword('haslo123') } });
const lider = await mk('zjlider', 'LEADER');
await mk('zjadmin', 'ADMIN');
await mk('zjdyr', 'DIRECTOR');
// lider należy TYLKO do Squad ZJ-A1 — zasięg ma objąć cały Tribe ZJ-A (FR-H1), ale nic wyżej ani obok
await prisma.orgUnitMembership.create({ data: { employeeId: lider.id, orgUnitId: squadA1.id } });

const aLider = as(await login('zjlider', 'haslo123'));
const aAdmin = as(await login('zjadmin', 'haslo123'));
const aDyr = as(await login('zjdyr', 'haslo123'));

// ── 1. Lista jednostek zawężona do zasięgu ────────────────────────────────────
const widoczne = await j(await aLider('/org/units'));
const nazwy = new Set(widoczne.map((u) => u.name));
ok(nazwy.has('Tribe ZJ-A') && nazwy.has('Squad ZJ-A1') && nazwy.has('Squad ZJ-A2'),
  'lider widzi swój Tribe i oba jego squady (także ten, w którym nie jest — FR-H1)');
ok(!nazwy.has('Pion ZJ') && !nazwy.has('Departament ZJ'),
  'lider NIE widzi Pionu ani Departamentu (były źródłem 403 przy autowyborze)');
ok(!nazwy.has('Tribe ZJ-B') && !nazwy.has('Squad ZJ-B1'), 'lider NIE widzi obcego Tribe ani jego squadów');

// ── 2. Najważniejsze: każda pokazana jednostka jest akceptowana ───────────────
const kody = [];
for (const u of widoczne) kody.push((await aLider(`/reports/usage?unitId=${u.id}`)).status);
ok(kody.every((s) => s === 200), `każda jednostka z listy działa w raportach — kody: ${[...new Set(kody)].join(',')} (brak 403)`);

// pierwsza pozycja listy = ta, którą UI wybiera automatycznie
ok((await aLider(`/reports/usage?unitId=${widoczne[0].id}`)).status === 200,
  `autowybór pierwszej pozycji („${widoczne[0].name}") nie kończy się błędem`);

// a jednostka spoza listy nadal jest blokowana — zawężenie listy nie osłabiło strażnika
ok((await aLider(`/reports/usage?unitId=${dept.id}`)).status === 403, 'Departament spoza zasięgu → nadal 403');
ok((await aLider(`/capacity?sprintId=x&unitId=${squadB1.id}`)).status === 403, 'obcy squad w capacity → nadal 403');

// ── 3. Role org-wide bez zmian ────────────────────────────────────────────────
const adminUnits = await j(await aAdmin('/org/units'));
const dyrUnits = await j(await aDyr('/org/units'));
const wszystkie = ['Pion ZJ', 'Departament ZJ', 'Tribe ZJ-A', 'Tribe ZJ-B', 'Squad ZJ-A1', 'Squad ZJ-A2', 'Squad ZJ-B1'];
ok(wszystkie.every((n) => adminUnits.some((u) => u.name === n)), 'admin nadal widzi całą strukturę');
ok(wszystkie.every((n) => dyrUnits.some((u) => u.name === n)), 'dyrektor nadal widzi całą strukturę');

// ── 4. Drzewo przycięte tak samo ──────────────────────────────────────────────
const drzewo = await j(await aLider('/org/tree'));
const plaskie = [];
const zbierz = (n) => { plaskie.push(n.name); (n.children ?? []).forEach(zbierz); };
drzewo.forEach(zbierz);
ok(drzewo.length === 1 && drzewo[0].name === 'Tribe ZJ-A', 'drzewo lidera ma korzeń w jego Tribe (bez Pionu/Departamentu nad nim)');
ok(!plaskie.includes('Tribe ZJ-B') && plaskie.includes('Squad ZJ-A2'), 'drzewo lidera zawiera jego squady i nie zawiera obcego Tribe');

// ── 5. Katalog pracowników zawężony tak samo (wiersze, nie tylko pola) ────────
// obsada: lider + jedna osoba w jego Tribe, jedna w obcym
const swoj = await mk('zjswoj', 'EMPLOYEE');
const obcy = await mk('zjobcy', 'EMPLOYEE');
await prisma.orgUnitMembership.create({ data: { employeeId: swoj.id, orgUnitId: squadA2.id } });
await prisma.orgUnitMembership.create({ data: { employeeId: obcy.id, orgUnitId: squadB1.id } });

const katalogLidera = await j(await aLider('/employees'));
ok(katalogLidera.some((e) => e.id === swoj.id), 'lider widzi w katalogu osobę ze swojego Tribe');
ok(!katalogLidera.some((e) => e.id === obcy.id), 'lider NIE widzi w katalogu osoby z obcego Tribe');
ok(katalogLidera.every((e) => e.email === undefined && e.login === undefined),
  'lider dostaje minimalny zestaw pól (bez e-maili i loginów)');

const katalogAdmina = await j(await aAdmin('/employees'));
ok(katalogAdmina.some((e) => e.id === obcy.id) && katalogAdmina.some((e) => e.id === swoj.id),
  'admin nadal widzi cały katalog');

await prisma.$disconnect();
console.log(failures === 0 ? '\nZAKRES JEDNOSTEK OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
