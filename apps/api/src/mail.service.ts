import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from './prisma.service';

// FR-E4 — kanał e-mail. SMTP_ENABLED=false → tryb dev (jsonTransport, nie wysyła realnie).
// Wysyłka best-effort (informacyjna): nigdy nie rzuca do wywołującego, zawsze odnotowuje próbę.
@Injectable()
export class MailService {
  private readonly transport: Transporter;
  private readonly from = process.env.SMTP_FROM ?? 'nieobecnosci@firma.example';
  private readonly log = new Logger('MailService');

  constructor(private readonly prisma: PrismaService) {
    this.transport = process.env.SMTP_ENABLED === 'true'
      ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 25, connectionTimeout: 5000 })
      : nodemailer.createTransport({ jsonTransport: true });
  }

  async send(to: string, subject: string, text: string, recipientId?: string): Promise<void> {
    try {
      await this.transport.sendMail({ from: this.from, to, subject, text });
      await this.prisma.auditLog.create({ data: { entity: 'Email', action: 'EMAIL_SENT', userId: recipientId ?? null, description: `do=${to}; temat=${subject}` } });
    } catch (e) {
      this.log.warn(`E-mail do ${to} nieudany: ${(e as Error).message}`);
      await this.prisma.auditLog.create({ data: { entity: 'Email', action: 'EMAIL_FAILED', userId: recipientId ?? null, description: `do=${to}; temat=${subject}` } }).catch(() => {});
    }
  }
}
