import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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
    req.user = this.auth.verify(token);

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
