import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { todayUtc } from '@nieobecnosci/core';
import { PrismaService } from '../prisma.service';
import { hashPassword, verifyPassword } from './password';

// Hasz nieodpowiadający żadnemu hasłu, liczony raz przy starcie. Służy wyłącznie temu, żeby
// próba logowania na NIEISTNIEJĄCY login kosztowała tyle samo czasu co na istniejący: bez tego
// odpowiedź wracała natychmiast (nie było czego sprawdzać), a dla istniejącego dopiero po
// przeliczeniu scrypta. Ta różnica wystarczy, by odpytać serwer o to, kto pracuje w firmie.
const DUMMY_HASH = hashPassword(randomBytes(32).toString('hex'));

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
    // Hasz liczymy ZAWSZE, także gdy login nie istnieje — patrz DUMMY_HASH. Wynik i tak
    // odrzucamy, chodzi wyłącznie o to, żeby czas odpowiedzi nie zdradzał istnienia konta.
    const pasuje = await verifyPassword(password, emp?.passwordHash ?? DUMMY_HASH);
    if (!emp || !emp.passwordHash || !pasuje) return null;
    // Zakończona współpraca zamyka dostęp już tutaj. Strażnik i tak by tego tokenu nie przyjął,
    // ale wydawanie poświadczenia, o którym z góry wiadomo, że jest martwe, pokazywałoby byłemu
    // pracownikowi udane logowanie i błąd dopiero na pierwszym ekranie.
    if (emp.endDate && emp.endDate < todayUtc()) return null;
    return { employeeId: emp.id };
  }
}
