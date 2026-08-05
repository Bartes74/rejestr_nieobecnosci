import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { verifyPassword } from './password';

// FR-H5 (przygotowanie) — szew pod przyszłe SSO/OIDC. Za interfejsem siedzi WYŁĄCZNIE weryfikacja
// poświadczeń; wydanie tokenu JWT i audyt zostają w AuthService. Przyszły OidcAuthProvider zwróci
// { employeeId } po walidacji kodu/tokenu OIDC — bez zmian w wydawaniu tokenu ani w guardzie.
export abstract class AuthProvider {
  abstract authenticate(login: string, password: string): Promise<{ employeeId: string } | null>;
}

@Injectable()
export class LocalAuthProvider extends AuthProvider {
  constructor(private readonly prisma: PrismaService) { super(); }

  async authenticate(login: string, password: string): Promise<{ employeeId: string } | null> {
    const emp = await this.prisma.employee.findUnique({ where: { login } });
    if (!emp || !emp.passwordHash || !verifyPassword(password, emp.passwordHash)) return null;
    return { employeeId: emp.id };
  }
}
