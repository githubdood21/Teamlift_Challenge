import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { equalSecrets } from './calendar-security.js';

@Injectable()
export class HostAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.HOST_ADMIN_KEY;
    if (!expected || expected.length < 32)
      throw new ServiceUnavailableException(
        'Host admin access is not configured',
      );
    const request = context.switchToHttp().getRequest<Request>();
    const key =
      request.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ?? '';
    if (!equalSecrets(key, expected))
      throw new UnauthorizedException('Incorrect host admin key');
    return true;
  }
}
