import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma.service';
import { AuthProvider } from './auth-provider';
import type { AuthUser } from './current-user.decorator';

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
    const token = jwt.sign({ sub: emp.id }, secret(), { expiresIn: '12h', algorithm: 'HS256' });
    // NFR-8 — pomiar zaangażowania (udane logowania).
    await this.prisma.auditLog.create({ data: { entity: 'Auth', action: 'LOGIN_SUCCESS', userId: emp.id, description: `Logowanie: ${login}.` } });
    return { token, user: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName, role: emp.role } };
  }

  /** Sprawdza podpis i zwraca tożsamość. Uprawnienia dokłada strażnik, z bazy. */
  verify(token: string): { sub: string } {
    try {
      return jwt.verify(token, secret(), { algorithms: ['HS256'] }) as { sub: string };
    } catch {
      throw new UnauthorizedException('Sesja wygasła lub token nieprawidłowy.');
    }
  }
}
