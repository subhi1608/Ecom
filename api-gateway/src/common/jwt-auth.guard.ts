import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from './jwt';

export const AUTH_COOKIE_NAME = 'access_token';

declare module 'express' {
  interface Request {
    user?: { id: string; email: string };
    authToken?: string;
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      request.user = verifyToken(token);
      // Stashed so the proxy can forward it downstream — order-service
      // re-verifies it independently rather than trusting our word.
      request.authToken = token;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
