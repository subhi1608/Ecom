import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard, AUTH_COOKIE_NAME } from './jwt-auth.guard';

const SECRET = 'test-secret';

function contextWith(cookies: Record<string, string>) {
  const request: any = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getRequest: () => request,
    _request: request,
  } as any;
}

describe('JwtAuthGuard', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it('allows a request carrying a valid token and attaches the user', () => {
    const token = jwt.sign({ sub: 'user-1', email: 'a@b.com' }, SECRET, {
      expiresIn: '1h',
    });
    const ctx = contextWith({ [AUTH_COOKIE_NAME]: token });
    const guard = new JwtAuthGuard();

    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx._request.user).toEqual({ id: 'user-1', email: 'a@b.com' });
    expect(ctx._request.authToken).toBe(token);
  });

  it('rejects a request with no cookie', () => {
    const guard = new JwtAuthGuard();

    expect(() => guard.canActivate(contextWith({}))).toThrow(UnauthorizedException);
  });

  it('rejects a malformed token', () => {
    const guard = new JwtAuthGuard();

    expect(() =>
      guard.canActivate(contextWith({ [AUTH_COOKIE_NAME]: 'not-a-jwt' })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: 'user-1', email: 'a@b.com' }, SECRET, {
      expiresIn: '-1s',
    });
    const guard = new JwtAuthGuard();

    expect(() =>
      guard.canActivate(contextWith({ [AUTH_COOKIE_NAME]: expired })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a token signed with the wrong secret', () => {
    const forged = jwt.sign({ sub: 'attacker', email: 'x@y.com' }, 'wrong-secret', {
      expiresIn: '1h',
    });
    const guard = new JwtAuthGuard();

    expect(() =>
      guard.canActivate(contextWith({ [AUTH_COOKIE_NAME]: forged })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a validly-signed token missing the email claim', () => {
    const token = jwt.sign({ sub: 'user-1' }, SECRET, { expiresIn: '1h' });
    const guard = new JwtAuthGuard();

    expect(() =>
      guard.canActivate(contextWith({ [AUTH_COOKIE_NAME]: token })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a token whose email claim is an object rather than a string', () => {
    const token = jwt.sign(
      { sub: 'user-1', email: { nested: 'oops' } },
      SECRET,
      { expiresIn: '1h' },
    );
    const guard = new JwtAuthGuard();

    expect(() =>
      guard.canActivate(contextWith({ [AUTH_COOKIE_NAME]: token })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a token signed with HS384 once the algorithm is pinned to HS256', () => {
    const token = jwt.sign({ sub: 'user-1', email: 'a@b.com' }, SECRET, {
      algorithm: 'HS384',
      expiresIn: '1h',
    });
    const guard = new JwtAuthGuard();

    expect(() =>
      guard.canActivate(contextWith({ [AUTH_COOKIE_NAME]: token })),
    ).toThrow(UnauthorizedException);
  });
});
