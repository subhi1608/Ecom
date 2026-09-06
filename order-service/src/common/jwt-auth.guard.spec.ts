import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'test-secret';

function contextWith(headers: Record<string, string>) {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    _request: request,
  } as any;
}

describe('JwtAuthGuard (order-service)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it('accepts a valid Bearer token and attaches the user', () => {
    const token = jwt.sign({ sub: 'user-1', email: 'a@b.com' }, SECRET, { expiresIn: '1h' });
    const ctx = contextWith({ authorization: `Bearer ${token}` });

    expect(new JwtAuthGuard().canActivate(ctx)).toBe(true);
    expect(ctx._request.user).toEqual({ id: 'user-1', email: 'a@b.com' });
  });

  it('rejects a request with no Authorization header', () => {
    expect(() => new JwtAuthGuard().canActivate(contextWith({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a forged x-user-email header with no token', () => {
    // The whole reason this guard exists: port 3001 is published, so
    // trusting a gateway-supplied identity header would make the ownership
    // rule cosmetic.
    const ctx = contextWith({ 'x-user-email': 'victim@example.com' });

    expect(() => new JwtAuthGuard().canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects a token signed with the wrong secret', () => {
    const forged = jwt.sign({ sub: 'attacker', email: 'x@y.com' }, 'wrong-secret', {
      expiresIn: '1h',
    });

    expect(() =>
      new JwtAuthGuard().canActivate(contextWith({ authorization: `Bearer ${forged}` })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: 'user-1', email: 'a@b.com' }, SECRET, {
      expiresIn: '-1s',
    });

    expect(() =>
      new JwtAuthGuard().canActivate(contextWith({ authorization: `Bearer ${expired}` })),
    ).toThrow(UnauthorizedException);
  });
});
