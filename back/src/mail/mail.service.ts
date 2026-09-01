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

  async sendCollectionDebtReminder(
    to: string,
    params: {
      recipientName: string;
      collectionTitle: string;
      troupeTitle: string;
      amountRub: number;
      dueAt: string | null;
      collectionUrl: string;
    },
  ): Promise<void> {
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

    const amountLabel = `${params.amountRub.toLocaleString('ru-RU')} ₽`;
    const dueLine = params.dueAt
      ? `Срок: ${params.dueAt}`
      : 'Срок не указан';
    const subject = `Напоминание о взносе: ${params.collectionTitle}`;
    const text = [
      `Здравствуйте, ${params.recipientName}!`,
      '',
      `Труппа «${params.troupeTitle}» напоминает о сборе «${params.collectionTitle}».`,
      `К оплате: ${amountLabel}`,
      dueLine,
      '',
      `Открыть сбор: ${params.collectionUrl}`,
      '',
      'Если вы уже внесли взнос, сообщите казначею — он отметит платёж в Orchestra.',
    ].join('\n');

    const html = `<p>Здравствуйте, ${params.recipientName}!</p>
<p>Труппа «${params.troupeTitle}» напоминает о сборе <strong>${params.collectionTitle}</strong>.</p>
<p>К оплате: <strong>${amountLabel}</strong><br/>${dueLine}</p>
<p><a href="${params.collectionUrl}">Открыть сбор в Orchestra</a></p>
<p style="font-size:12px;color:#666;">Если вы уже внесли взнос, сообщите казначею — он отметит платёж в Orchestra.</p>`;

    await transporter.sendMail({
      from: fromRaw,
      to,
      subject,
      text,
      html,
    });

    this.logger.log(`Collection reminder sent to ${to}`);
  }

  async sendUpgradeRequest(params: {
    fromEmail: string;
    planName: string;
    message?: string;
  }): Promise<boolean> {
    const host = String(this.config.get('SMTP_HOST') ?? '').trim();
    const to =
      String(this.config.get('MAIL_ADMIN') ?? '').trim() ||
      'sergey@lunyak.ru';
    const text = [
      `Запрос тарифа: ${params.planName}`,
      `Пользователь: ${params.fromEmail}`,
      params.message ? `Комментарий: ${params.message}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    this.logger.log(`Upgrade request: ${params.fromEmail} → ${params.planName}`);
    if (!host) return false;

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

    await transporter.sendMail({
      from: fromRaw,
      to,
      subject: `Orchestra: запрос тарифа ${params.planName}`,
      text,
    });
    return true;
  }
}
