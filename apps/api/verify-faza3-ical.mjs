// B3 / FR-F4 — kanały iCal: własny (z typami) i zespołu (JEDNOLITY, bez typu — L4 niewyróżniane).
// Token subskrypcji w query (webcal nie wysyła Bearer). Guard RODO: kanał zespołu nigdy nie ujawnia nazwy L4.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './dist/auth/auth.service.js';

const API = process.env.API ?? 'http://localhost:3100/api';
const prisma = new PrismaClient();
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };
const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const login = async (l, p) => (await j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: l, password: p }) }))).token;

for (let i = 0; i < 30; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const tribe = await prisma.orgUnit.create({ data: { name: 'Tribe ICAL', type: 'TRIBE' } });
const squad = await prisma.orgUnit.create({ data: { name: 'Squad ICAL', type: 'SQUAD', parentId: tribe.id } });
const anna = await prisma.employee.create({ data: { firstName: 'Anna', lastName: 'ICS', email: 'icsanna@x.pl', login: 'icsanna', role: 'EMPLOYEE', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
await prisma.orgUnitMembership.create({ data: { employeeId: anna.id, orgUnitId: squad.id } });
const urlop = await prisma.absenceType.create({ data: { name: 'Urlop ICAL' } });
const l4 = await prisma.absenceType.create({ data: { name: 'L4 SEKRET ICAL', affectsPool: false, specialCategory: true } });
await prisma.absence.create({ data: { employeeId: anna.id, typeId: urlop.id, dateFrom: new Date('2026-07-14'), dateTo: new Date('2026-07-18') } });
await prisma.absence.create({ data: { employeeId: anna.id, typeId: l4.id, dateFrom: new Date('2026-08-03'), dateTo: new Date('2026-08-04') } });

// token subskrypcji (tworzony leniwie przez endpoint uwierzytelniony)
const tok = (await j(await fetch(`${API}/me/feed-token`, { headers: { authorization: `Bearer ${await login('icsanna', 'haslo123')}` } }))).token;
ok(typeof tok === 'string' && tok.length >= 32, 'token subskrypcji wygenerowany');

// kanał WŁASNY (publiczny, po tokenie) — z typami (dane użytkownika)
const me = await (await fetch(`${API}/feed/me.ics?token=${tok}`)).text();
ok(me.startsWith('BEGIN:VCALENDAR') && me.includes('DTSTART;VALUE=DATE:20260714') && me.includes('DTEND;VALUE=DATE:20260719'), 'kanał własny: poprawny VCALENDAR z all-day VEVENT (DTEND+1)');
ok(me.includes('Urlop ICAL') && me.includes('L4 SEKRET ICAL'), 'kanał własny pokazuje prawdziwe typy (to dane usera)');

// kanał ZESPOŁU (publiczny, po tokenie) — JEDNOLITY, bez typu
const team = await (await fetch(`${API}/feed/team.ics?token=${tok}`)).text();
ok(team.includes('SUMMARY:Nieobecność – Anna ICS'), 'kanał zespołu: wpisy jednolite „Nieobecność – Imię Nazwisko"');
ok(!team.includes('L4 SEKRET ICAL') && !team.includes('Urlop ICAL'), 'kanał zespołu NIGDY nie ujawnia typu (L4 niewyróżniane — RODO/D2/H3)');

// brak/zły token → 404
ok((await fetch(`${API}/feed/team.ics?token=zly`)).status === 404, 'zły token → 404');

await prisma.$disconnect();
console.log(failures === 0 ? '\nFAZA 3 (eksport iCal F4) OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
