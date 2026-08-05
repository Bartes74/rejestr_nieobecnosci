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
    const emp = await this.prisma.employee.findUnique({ where: { id: result.employeeId }, include: { permissions: true } });
    if (!emp) throw new UnauthorizedException('Błędny login lub hasło.');
    const payload = { sub: emp.id, role: emp.role, permissions: emp.permissions.map((p) => p.scope) };
    const token = jwt.sign(payload, secret(), { expiresIn: '12h', algorithm: 'HS256' });
    // NFR-8 — pomiar zaangażowania (udane logowania).
    await this.prisma.auditLog.create({ data: { entity: 'Auth', action: 'LOGIN_SUCCESS', userId: emp.id, description: `Logowanie: ${login}.` } });
    return { token, user: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName, role: emp.role } };
  }

  verify(token: string): AuthUser {
    try {
      return jwt.verify(token, secret(), { algorithms: ['HS256'] }) as AuthUser;
    } catch {
      throw new UnauthorizedException('Sesja wygasła lub token nieprawidłowy.');
    }
  }
}
