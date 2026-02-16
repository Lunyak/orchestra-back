import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = this.config.get<string>('ADMIN_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Admin is not configured');
    }
    const auth = request.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : auth;
    if (token !== secret) {
      throw new UnauthorizedException('Invalid admin secret');
    }
    return true;
  }
}
