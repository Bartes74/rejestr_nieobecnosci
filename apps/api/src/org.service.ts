import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import type { AuthUser } from './auth/current-user.decorator';

// FR-H1 — widoczność w obrębie Tribe. Skala mała (kilkadziesiąt jednostek),
// więc liczymy w pamięci zamiast rekurencyjnego CTE.
@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  // Jednostki w zasięgu osoby = poddrzewa wszystkich jej Tribe (puste, jeśli poza Tribe).
  async scopeUnitIds(employeeId: string): Promise<Set<string>> {
    const [units, memberships] = await Promise.all([
      this.prisma.orgUnit.findMany(),
      this.prisma.orgUnitMembership.findMany(),
    ]);
    const byId = new Map(units.map((u) => [u.id, u]));
    const childrenOf = new Map<string, string[]>();
    for (const u of units) {
      if (!u.parentId) continue;
      (childrenOf.get(u.parentId) ?? childrenOf.set(u.parentId, []).get(u.parentId)!).push(u.id);
    }
    const tribeOf = (unitId: string): string | undefined => {
      let cur = byId.get(unitId);
      while (cur && cur.type !== 'TRIBE') cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      return cur?.id;
    };
    const myTribes = new Set(
      memberships.filter((m) => m.employeeId === employeeId).map((m) => tribeOf(m.orgUnitId)).filter((id): id is string => Boolean(id)),
    );
    const inScope = new Set<string>();
    const collect = (id: string) => { inScope.add(id); for (const c of childrenOf.get(id) ?? []) collect(c); };
    for (const t of myTribes) collect(t);
    return inScope;
  }

  async tribePeers(employeeId: string): Promise<string[]> {
    const inScope = await this.scopeUnitIds(employeeId);
    if (inScope.size === 0) return [employeeId]; // poza Tribe — widzi tylko siebie
    const memberships = await this.prisma.orgUnitMembership.findMany();
    const peers = new Set(memberships.filter((m) => inScope.has(m.orgUnitId)).map((m) => m.employeeId));
    peers.add(employeeId);
    return [...peers];
  }

  // H2 — autoryzacja pozioma raportów/capacity: role org-wide widzą wszystko;
  // lider/PO tylko jednostki w poddrzewie swojego Tribe.
  async assertUnitInScope(user: AuthUser, unitId: string): Promise<void> {
    if (user.role === 'DIRECTOR' || user.role === 'ADMIN' || user.role === 'PMO') return;
    const scope = await this.scopeUnitIds(user.sub);
    if (!scope.has(unitId)) throw new ForbiddenException('Brak dostępu do tej jednostki organizacyjnej.');
  }

  // FR-F3 — wszystkie jednostki w poddrzewie (z korzeniem włącznie).
  async subtreeUnitIds(rootId: string): Promise<string[]> {
    const units = await this.prisma.orgUnit.findMany();
    const childrenOf = new Map<string, string[]>();
    for (const u of units) {
      if (!u.parentId) continue;
      (childrenOf.get(u.parentId) ?? childrenOf.set(u.parentId, []).get(u.parentId)!).push(u.id);
    }
    const out: string[] = [];
    const dfs = (id: string) => {
      out.push(id);
      for (const c of childrenOf.get(id) ?? []) dfs(c);
    };
    dfs(rootId);
    return out;
  }

  // Pracownicy (unikalni) należący do dowolnej jednostki w poddrzewie.
  async employeeIdsInUnit(rootId: string): Promise<string[]> {
    const ids = await this.subtreeUnitIds(rootId);
    const memberships = await this.prisma.orgUnitMembership.findMany({ where: { orgUnitId: { in: ids } } });
    return [...new Set(memberships.map((m) => m.employeeId))];
  }
}
