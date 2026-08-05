import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Trasa dostępna bez logowania (np. /auth/login, /health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Ogranicza trasę do podanych ról. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
