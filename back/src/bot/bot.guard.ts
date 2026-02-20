import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BotGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = this.config.get<string>('BOT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Bot is not configured');
    }
    const auth = request.headers.authorization;
    const tokenFromAuth = auth?.startsWith('Bearer ') ? auth.slice(7) : auth;
    const tokenFromHeader =
      (request.headers['x-bot-secret'] as string | undefined) ||
      (request.headers['x-bot-token'] as string | undefined);
    const token = tokenFromAuth || tokenFromHeader;
    if (token !== secret) {
      throw new UnauthorizedException('Invalid bot secret');
    }

    // For multi-bot: bot-service must explicitly specify which integration it acts as.
    const integrationId =
      (request.headers['x-telegram-bot-integration-id'] as string | undefined) ||
      (request.headers['x-bot-integration-id'] as string | undefined);
    const botIntegrationId = String(integrationId ?? '').trim();
    if (!botIntegrationId) {
      throw new UnauthorizedException('Missing bot integration id');
    }

    const exists = (await this.prisma.$queryRawUnsafe(
      `SELECT "id" FROM "TelegramBotIntegration" WHERE "id" = $1 LIMIT 1`,
      botIntegrationId,
    )) as Array<{ id: string }>;
    if (exists.length === 0) {
      throw new UnauthorizedException('Unknown bot integration id');
    }

    (request as any).botIntegrationId = botIntegrationId;
    return true;
  }
}
