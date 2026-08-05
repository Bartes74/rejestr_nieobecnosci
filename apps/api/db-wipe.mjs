// Czyszczenie bazy (dev) — opróżnia wszystkie tabele. Krok „czyszczenie bazy" przed pełnym
// przebiegiem suit verify-*.mjs (kolejność: wipe → suity → ponowny demo-seed). Tylko dla bazy deweloperskiej!
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
await prisma.auditLog.deleteMany(); await prisma.absence.deleteMany(); await prisma.leaveAllowance.deleteMany();
await prisma.permission.deleteMany(); await prisma.orgUnitMembership.deleteMany(); await prisma.sprint.deleteMany();
await prisma.holiday.deleteMany(); await prisma.employee.deleteMany(); await prisma.orgUnit.deleteMany();
await prisma.holidayCalendar.deleteMany(); await prisma.absenceType.deleteMany(); await prisma.processingActivity.deleteMany();
await prisma.adminSetting.deleteMany();
await prisma.$disconnect();
console.log('Baza wyczyszczona.');
