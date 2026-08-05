import type { AuthUser } from './current-user.decorator';

// Bazowy RBAC (MVP). Pełny model uprawnień — Faza 2 (FR-H2).
export const isAdmin = (u: AuthUser): boolean => u.role === 'ADMIN';

// Może modyfikować cudze nieobecności (np. dodać L4 w imieniu innych) — FR-H4.
export const canModifyOthers = (u: AuthUser): boolean => isAdmin(u) || u.permissions.includes('MODIFY_ABSENCE');

// Może odczytać znacznik szczególny (L4) cudzych wpisów — FR-J1.
export const canViewL4 = (u: AuthUser): boolean => isAdmin(u) || u.permissions.includes('VIEW_L4');
