import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

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
   * В проде не возвращаем token в ответе (его надо доставлять пользователю через email/бота).
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

    const nodeEnv = String(
      this.configService.get('NODE_ENV') ?? process.env.NODE_ENV ?? '',
    );
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
