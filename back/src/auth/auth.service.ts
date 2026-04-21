import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

function normalizeEmail(email: string): string {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

function sha256Base64Url(input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

/** WEB_DOMAIN в репозитории обычно без схемы (orchestra.example.com). */
function originFromWebDomain(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    return s.replace(/\/+$/, '');
  }
  const isLocalHostish =
    s === 'localhost' ||
    s.startsWith('127.0.0.1') ||
    s.startsWith('192.168.') ||
    s.startsWith('10.');
  const scheme = isLocalHostish ? 'http' : 'https';
  return `${scheme}://${s}`.replace(/\/+$/, '');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private passwordResetAppBase(): string {
    const webDomain = String(
      this.configService.get<string>('WEB_DOMAIN') ?? '',
    ).trim();
    if (webDomain) return originFromWebDomain(webDomain);
    const legacy =
      this.configService.get<string>('PASSWORD_RESET_APP_URL') ??
      this.configService.get<string>('APP_FRONTEND_URL') ??
      '';
    return String(legacy ?? '').trim().replace(/\/+$/, '');
  }

  async register(email: string, password: string) {
    const normEmail = normalizeEmail(email);
    const existing = await this.usersService.findByEmail(normEmail);
    if (existing) {
      throw new UnauthorizedException('Email already in use');
    }
    const user = await this.usersService.createUser(normEmail, password);
    return this.buildTokens(user.id, normalizeEmail(user.email));
  }

  private async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(normalizeEmail(email), password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildTokens(user.id, normalizeEmail(user.email));
  }

  private async buildTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = await this.jwtService.signAsync(payload);

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      this.configService.get<string>('JWT_SECRET');
    const refreshExpires =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';

    const refreshOptions: JwtSignOptions = {
      secret: refreshSecret,
      // тип expiresIn в JwtSignOptions (StringValue) строже, чем string, поэтому приводим явно
      expiresIn: refreshExpires as any,
    };

    const refreshToken = await this.jwtService.signAsync(
      payload,
      refreshOptions,
    );

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ??
        this.configService.get<string>('JWT_SECRET');

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.buildTokens(user.id, normalizeEmail(user.email));
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Запрос на сброс пароля.
   * Важно: всегда отвечаем одинаково, чтобы не раскрывать существование email.
   * Если заданы WEB_DOMAIN (как в корневом деплое) и SMTP_*, на почту уходит ссылка на /reset-password?token=...
   * (хост без схемы → https://..., localhost/127.0.0.1/… → http://). Fallback: PASSWORD_RESET_APP_URL / APP_FRONTEND_URL.
   * В не-production (или при PASSWORD_RESET_RETURN_TOKEN=true) в ответе может вернуться token для отладки.
   */
  async requestPasswordReset(
    email: string,
  ): Promise<{ ok: true; token?: string }> {
    const normEmail = normalizeEmail(email);
    if (!normEmail) return { ok: true };

    const user = await this.usersService.findByEmail(normEmail);
    if (!user) return { ok: true };

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256Base64Url(rawToken);
    const ttlMin = Number(
      this.configService.get('PASSWORD_RESET_TTL_MIN') ?? 30,
    );
    const expiresAt = new Date(Date.now() + Math.max(5, ttlMin) * 60 * 1000);

    // Не держим бесконечное число активных токенов на пользователя
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const appBase = this.passwordResetAppBase();
    const smtpOk = this.mailService.isSmtpConfigured();
    const nodeEnv = String(
      this.configService.get('NODE_ENV') ?? process.env.NODE_ENV ?? '',
    );

    if (appBase && smtpOk) {
      const resetUrl = `${appBase}/reset-password?token=${encodeURIComponent(rawToken)}`;
      try {
        await this.mailService.sendPasswordResetLink(normEmail, resetUrl);
      } catch (err) {
        this.logger.error(
          `Password reset email failed for ${normEmail}`,
          err instanceof Error ? err.stack : err,
        );
      }
    } else {
      const hint =
        'Password reset: письмо не отправлено — задайте WEB_DOMAIN (домен веб-приложения) и SMTP_HOST (при необходимости SMTP_USER/SMTP_PASS).';
      if (nodeEnv === 'production') this.logger.warn(hint);
      else this.logger.debug(hint);
    }
    const allowReturn =
      nodeEnv !== 'production' ||
      String(this.configService.get('PASSWORD_RESET_RETURN_TOKEN') ?? '') ===
        'true';

    if (allowReturn) return { ok: true, token: rawToken };
    return { ok: true };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const raw = String(token ?? '').trim();
    if (!raw) throw new UnauthorizedException('Invalid token');

    const tokenHash = sha256Base64Url(raw);
    const now = new Date();

    const prt = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (!prt) throw new UnauthorizedException('Invalid token');

    await this.usersService.updatePassword(prt.userId, newPassword);
    await this.prisma.passwordResetToken.update({
      where: { id: prt.id },
      data: { usedAt: now },
    });

    return { ok: true };
  }
}
