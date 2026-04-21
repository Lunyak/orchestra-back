import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  /** Достаточно хоста: порт/логин могут быть пустыми (например локальный MailHog). */
  isSmtpConfigured(): boolean {
    return Boolean(String(this.config.get('SMTP_HOST') ?? '').trim());
  }

  async sendPasswordResetLink(to: string, resetUrl: string): Promise<void> {
    const host = String(this.config.get('SMTP_HOST') ?? '').trim();
    if (!host) {
      throw new Error('SMTP_HOST is not set');
    }

    const port = Number(this.config.get('SMTP_PORT') ?? 587);
    const secureRaw = String(this.config.get('SMTP_SECURE') ?? '').toLowerCase();
    const secure =
      secureRaw === 'true' || secureRaw === '1' || port === 465;

    const user = String(this.config.get('SMTP_USER') ?? '').trim();
    const pass = String(this.config.get('SMTP_PASS') ?? '');

    const fromRaw =
      String(this.config.get('MAIL_FROM') ?? '').trim() ||
      user ||
      'Orchestra <noreply@localhost>';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user ? { auth: { user, pass } } : {}),
    });

    const subject = 'Ссылка для смены пароля';
    const text = [
      'Вы запросили смену пароля в Orchestra.',
      '',
      `Откройте ссылку в браузере (она действует ограниченное время):`,
      resetUrl,
      '',
      'Если это были не вы, просто проигнорируйте письмо.',
    ].join('\n');

    const html = `<p>Вы запросили смену пароля в Orchestra.</p>
<p><a href="${resetUrl}">Перейти к смене пароля</a></p>
<p style="font-size:12px;color:#666;">Если ссылка не открывается, скопируйте адрес вручную:<br/><span style="word-break:break-all;">${resetUrl}</span></p>
<p style="font-size:12px;color:#666;">Если это были не вы, проигнорируйте письмо.</p>`;

    await transporter.sendMail({
      from: fromRaw,
      to,
      subject,
      text,
      html,
    });

    this.logger.log(`Password reset email queued/sent to ${to}`);
  }
}
