import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class RunnerSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const got =
      (request.headers['x-runner-secret'] as string | undefined) ||
      (request.headers['x-internal-secret'] as string | undefined);

    const expected = this.config.get<string>('INTERNAL_API_SECRET');

    if (!expected) {
      throw new UnauthorizedException('INTERNAL_API_SECRET is not configured');
    }
    if (String(got ?? '') !== String(expected)) {
      throw new UnauthorizedException('Invalid runner secret');
    }
    return true;
  }
}

