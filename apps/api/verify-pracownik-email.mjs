// Uwaga zleceniodawcy (feedback001): pusty e-mail przy dodawaniu pracownika dawał surowe
// „email must be an email" pod tabelą. E-mail jest wymagany (jedyny kanał powiadomień; docelowo
// konta zasila AD), komunikaty walidacji są po polsku, a duplikat loginu/e-maila to 409, nie 500.
import { as, failures, hashPassword, login, ok, prisma, waitForApi } from './verify-harness.mjs';

await waitForApi();

await prisma.employee.create({ data: { firstName: 'Adm', lastName: 'PE', email: 'peadmin@pe.pl', login: 'peadmin', role: 'ADMIN', employmentType: 'UOP', startDate: new Date('2026-01-01'), passwordHash: hashPassword('haslo123') } });
const aAdmin = as(await login('peadmin', 'haslo123'));
const post = (body) => aAdmin('/employees', { method: 'POST', body: JSON.stringify(body) });
const base = { firstName: 'Ewa', lastName: 'PE', login: 'peewa', employmentType: 'UOP', startDate: '2026-01-01' };
const msg = async (r) => { const b = await r.json(); return Array.isArray(b.message) ? b.message.join(', ') : String(b.message); };

let r = await post({ ...base, email: '' });
let m = await msg(r);
ok(r.status === 400, 'pusty e-mail → 400');
ok(/e-mail/i.test(m) && !/must be/i.test(m), `komunikat po polsku i o e-mailu: „${m}"`);
r = await post({ ...base, email: 'zly' });
ok(r.status === 400 && /e-mail/i.test(await msg(r)), 'niepoprawny e-mail → 400 z polskim komunikatem');
r = await post({ ...base, email: 'ewa@pe.pl', startDate: 'wczoraj' });
ok(r.status === 400 && /RRRR-MM-DD/.test(await msg(r)), 'zła data startu → 400 z polskim komunikatem');
ok((await post({ ...base, email: 'ewa@pe.pl' })).status === 201, 'poprawny komplet → 201');
r = await post({ ...base, login: 'peewa2', email: 'ewa@pe.pl' });
ok(r.status === 409 && /zajęty/.test(await msg(r)), 'duplikat e-maila → 409 z treścią, nie 500');
ok((await post({ ...base, email: 'inna@pe.pl' })).status === 409, 'duplikat loginu → 409');

await prisma.$disconnect();
console.log(failures === 0 ? '\nE-MAIL PRACOWNIKA OK ✅' : `\n${failures} ASERCJI NIE PRZESZŁO ❌`);
process.exit(failures === 0 ? 0 : 1);
