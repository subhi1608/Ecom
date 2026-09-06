import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

declare module 'express' {
  interface Request {
    user?: { id: string; email: string };
  }
}

// order-service verifies the JWT itself rather than trusting an identity
// header from the gateway. docker-compose publishes port 3001, so header
// trust would let anyone read another user's orders with a forged header.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const claims = jwt.verify(
        header.slice('Bearer '.length),
        process.env.JWT_SECRET,
      ) as jwt.JwtPayload;
      request.user = { id: String(claims.sub), email: String(claims.email) };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
