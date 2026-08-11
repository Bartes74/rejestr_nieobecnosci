import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma.service';
import { AuthProvider } from './auth-provider';

// Re-eksport dla zgodności (employees.service oraz suity verify-*.mjs importują stąd).
export { hashPassword, verifyPassword } from './password';

// Leniwy odczyt sekretu — po walidacji env w main.ts (assertEnv). Brak module-level capture przy imporcie.
const secret = (): string => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET nie jest ustawiony.');
  return s;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AuthProvider, // FR-H5 — weryfikacja poświadczeń za interfejsem (lokalnie / docelowo OIDC)
  ) {}

  async login(login: string, password: string) {
    const result = await this.provider.authenticate(login, password);
    if (!result) {
      // NFR-5 — rejestracja nieudanych prób logowania (id znamy tylko gdy login istnieje).
      const emp = await this.prisma.employee.findUnique({ where: { login } });
      await this.prisma.auditLog.create({
        data: { entity: 'Auth', action: 'LOGIN_FAILED', userId: emp?.id ?? null, description: `Nieudane logowanie dla loginu "${login}".` },
      });
      throw new UnauthorizedException('Błędny login lub hasło.');
    }
    const emp = await this.prisma.employee.findUnique({ where: { id: result.employeeId } });
    if (!emp) throw new UnauthorizedException('Błędny login lub hasło.');
    // Token niesie WYŁĄCZNIE tożsamość. Rola i uprawnienia wpisane do niego były kopią, której
    // nie dawało się unieważnić: odebranie uprawnienia, zmiana roli i anonimizacja zaczynały
    // działać dopiero po wygaśnięciu tokenu, czyli do dwunastu godzin później. Aktualny zestaw
    // uprawnień czyta strażnik z bazy przy każdym żądaniu (AuthGuard).
    // `iatMs` obok standardowego `iat`: ten drugi ma rozdzielczość sekundową, a unieważnianie
    // sesji (FR-J2) porównuje moment wydania tokenu z momentem anonimizacji albo resetu hasła.
    // Przy sekundowej ziarnistości te dwa zdarzenia potrafią wypaść w tej samej sekundzie i nie
    // da się orzec, co było pierwsze — a wybór dowolnej strony jest zły: albo stara sesja
    // przeżywa anonimizację, albo świeże logowanie tuż po resecie hasła jest odrzucane
    // i administrator zamyka pracownika poza kontem, któremu właśnie ustawił hasło.
    const token = jwt.sign({ sub: emp.id, iatMs: Date.now() }, secret(), { expiresIn: '12h', algorithm: 'HS256' });
    // NFR-8 — pomiar zaangażowania (udane logowania).
    await this.prisma.auditLog.create({ data: { entity: 'Auth', action: 'LOGIN_SUCCESS', userId: emp.id, description: `Logowanie: ${login}.` } });
    return { token, user: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName, role: emp.role } };
  }

  /**
   * Sprawdza podpis i zwraca tożsamość wraz z momentem wydania. Uprawnienia dokłada strażnik,
   * z bazy. Moment wydania jest mu potrzebny, by odróżnić sesję sprzed anonimizacji albo resetu
   * hasła od wydanej po nich — patrz `Employee.sessionsValidFrom`.
   *
   * `iatMs` jest opcjonalne, bo tokeny wydane przed jego wprowadzeniem go nie mają. Dla nich
   * strażnik schodzi do `iat * 1000`, czyli do początku sekundy — w stronę bezpieczną
   * (taki token prędzej wypadnie jako starszy, niż niesłusznie przeżyje).
   */
  verify(token: string): { sub: string; iat: number; iatMs?: number } {
    try {
      return jwt.verify(token, secret(), { algorithms: ['HS256'] }) as { sub: string; iat: number; iatMs?: number };
    } catch {
      throw new UnauthorizedException('Sesja wygasła lub token nieprawidłowy.');
    }
  }
}
