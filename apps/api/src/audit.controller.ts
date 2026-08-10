import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Roles } from './auth/decorators';

// FR-I1 / NFR-5 — podgląd dziennika audytu (tylko administrator).
@Roles('ADMIN')
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
  ) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(entityId ? { entityId } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(Number(limit) || 100, 500),
    });

    // Wiersz niesie same identyfikatory, a `AuditLog` nie ma relacji (dziennik ma przeżyć usunięcie
    // tego, co opisuje). Bez rozwinięcia ich w nazwiska dziennik odpowiada „kiedy" i „co", ale nie
    // „kto" ani „komu" — czyli nie odpowiada na pytanie, po które się do niego zagląda.
    // Oba pola wskazują pracownika, więc rozwija je jedno zapytanie. Nazwisko idzie z tabeli
    // pracowników, nie z dziennika — dzięki temu anonimizacja (FR-J2) czyści też audyt.
    const ids = [...new Set(rows.flatMap((r) => [r.userId, r.subjectId]).filter((v): v is string => !!v))];
    if (ids.length === 0) return rows.map((r) => ({ ...r, userName: null, subjectName: null }));

    const people = await this.prisma.employee.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true },
    });
    const name = new Map(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
    return rows.map((r) => ({
      ...r,
      userName: (r.userId && name.get(r.userId)) ?? null,
      subjectName: (r.subjectId && name.get(r.subjectId)) ?? null,
    }));
  }
}
