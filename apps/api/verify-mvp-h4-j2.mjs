// Domknięcie MVP: FR-H4 (role + nadawanie/odbieranie uprawnień) + FR-J2 (retencja/anonimizacja).
import { as, failures, hashPassword, j, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

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

// Lista zakresów zawiera wyłącznie te, na których coś stoi. ADMIN i REPORTS dawały się nadać
// i nie robiły nic (dostęp administratora i raportowy wynika z ROLI) — mylące przy nadawaniu,
// a groźne, gdyby ktoś kiedyś oparł na takiej nazwie warunek. Odrzucenie na wejściu pilnuje,
// żeby nie wróciły niepostrzeżenie.
for (const martwy of ['ADMIN', 'REPORTS']) {
  const odp = await aAdmin(`/employees/${bob.id}/permissions`, { method: 'POST', body: JSON.stringify({ scope: martwy }) });
  ok(odp.status === 400, `martwy zakres ${martwy} odrzucony na wejściu → 400`);
}

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
