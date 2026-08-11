import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { todayUtc } from '@nieobecnosci/core';
import type { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { IS_PUBLIC, ROLES } from './decorators';

// Globalny strażnik: wymaga tokenu (poza @Public) i egzekwuje @Roles.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('Wymagane logowanie.');

    // Token dowodzi tożsamości; kim ta osoba JEST DZIŚ, mówi baza. Uprawnienia wpisane do tokenu
    // były kopią sprzed nawet dwunastu godzin, więc odebranie roli albo uprawnienia rozszerzonego
    // nie odbierało dostępu, a konto zanonimizowane działało dalej na wydanym wcześniej tokenie.
    // ponytail: jedno zapytanie na żądanie — przy 300 użytkownikach z NFR-1 poniżej progu
    // zauważalności. Przy większej skali: cache z krótkim TTL, czyszczony przy zmianie uprawnień.
    const { sub } = this.auth.verify(token);
    const emp = await this.prisma.employee.findUnique({
      where: { id: sub },
      select: { id: true, role: true, endDate: true, permissions: { select: { scope: true } } },
    });
    if (!emp) throw new UnauthorizedException('Konto nie istnieje.');
    // `todayUtc()`, nie `new Date()` — data zakończenia to etykieta kalendarzowa w strefie
    // organizacji, więc porównanie musi trafiać co do dnia (patrz komentarz w BalanceService).
    if (emp.endDate && emp.endDate < todayUtc()) throw new UnauthorizedException('Współpraca zakończona.');
    req.user = { sub: emp.id, role: emp.role, permissions: emp.permissions.map((p) => p.scope) };

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(req.user.role)) {
      // NFR-5 — rejestracja odmów dostępu wg roli.
      await this.prisma.auditLog.create({
        data: { entity: 'Auth', action: 'ACCESS_DENIED', userId: req.user.sub, description: `${req.method} ${req.url} — rola ${req.user.role}.` },
      });
      throw new ForbiddenException('Brak uprawnień do tej operacji.');
    }
    return true;
  }
}
