import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class BotGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
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
    return true;
  }
}
