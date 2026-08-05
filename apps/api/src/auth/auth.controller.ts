import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma.service';
import { AuthService } from './auth.service';
import { Public } from './decorators';
import { CurrentUser, type AuthUser } from './current-user.decorator';
import { LoginDto } from '../dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // M1 — surowszy limit na logowaniu (ochrona przed brute-force). Globalny throttler aktywny tylko w produkcji.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.login, dto.password);
  }

  @Get('me')
  async me(@CurrentUser() u: AuthUser) {
    const e = await this.prisma.employee.findUnique({ where: { id: u.sub } });
    if (!e) return null;
    return {
      id: e.id, firstName: e.firstName, lastName: e.lastName,
      role: e.role, employmentType: e.employmentType, permissions: u.permissions,
    };
  }
}
