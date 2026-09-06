import { of, throwError } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { AuthController } from './auth.controller';
import { AUTH_COOKIE_NAME } from '../common/jwt-auth.guard';

function fakeResponse() {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as any;
}

function fakeRequest(overrides: any = {}) {
  return { correlationId: 'corr-1', ...overrides } as any;
}

describe('AuthController', () => {
  function setup() {
    const http: any = { post: jest.fn() };
    const controller = new AuthController(http);
    return { controller, http };
  }

  it('sets an httpOnly, sameSite=lax cookie on successful login', async () => {
    const { controller, http } = setup();
    http.post.mockReturnValue(
      of({ data: { token: 'jwt-token', user: { id: 'user-1', email: 'a@b.com' } } }),
    );
    const res = fakeResponse();

    const result = await controller.login(
      { email: 'a@b.com', password: 'supersecret' } as any,
      fakeRequest(),
      res,
    );

    expect(res.cookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      'jwt-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
    // The token must never reach the response body — that would defeat
    // httpOnly by handing JS a readable copy.
    expect(result).toEqual({ user: { id: 'user-1', email: 'a@b.com' } });
  });

  it('sets the cookie on register too, so a new user is already signed in', async () => {
    const { controller, http } = setup();
    http.post.mockReturnValue(
      of({ data: { token: 'jwt-token', user: { id: 'user-2', email: 'c@d.com' } } }),
    );
    const res = fakeResponse();

    await controller.register(
      { email: 'c@d.com', password: 'supersecret' } as any,
      fakeRequest(),
      res,
    );

    expect(res.cookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      'jwt-token',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('clears the cookie on logout', async () => {
    const { controller } = setup();
    const res = fakeResponse();

    const result = await controller.logout(res);

    expect(res.clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, expect.any(Object));
    expect(result).toEqual({ success: true });
  });

  it('returns the user from the verified token on /auth/me', async () => {
    const { controller } = setup();

    const result = await controller.me(fakeRequest({ user: { id: 'user-1', email: 'a@b.com' } }));

    expect(result).toEqual({ user: { id: 'user-1', email: 'a@b.com' } });
  });
});

describe('AuthController cookie lifetime and error handling', () => {
  const OLD_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV;
  });

  function setup() {
    const http: any = { post: jest.fn() };
    const controller = new AuthController(http);
    return { controller, http };
  }

  function axiosFailure(status: number, data: unknown) {
    return {
      isAxiosError: true,
      message: `Request failed with status code ${status}`,
      // Axios carries the original request body — the user's password.
      config: { data: JSON.stringify({ email: 'a@b.com', password: 'supersecret' }) },
      response: { status, data },
    };
  }

  it('derives cookie maxAge from the token\'s real exp, not a hardcoded hour', async () => {
    const { controller, http } = setup();
    // A token that genuinely expires in 15 minutes, not the 1h default.
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com' }, 'test-secret', {
      expiresIn: '15m',
    });
    http.post.mockReturnValue(of({ data: { token, user: { id: 'u1', email: 'a@b.com' } } }));
    const res = fakeResponse();

    await controller.login({ email: 'a@b.com', password: 'pw' } as any, fakeRequest(), res);

    const opts = res.cookie.mock.calls[0][2];
    // Should be ~15min, decisively not the hardcoded 3600000ms.
    expect(opts.maxAge).toBeLessThan(16 * 60 * 1000);
    expect(opts.maxAge).toBeGreaterThan(14 * 60 * 1000);
  });

  it('sets and clears the cookie with matching attributes', async () => {
    const { controller, http } = setup();
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com' }, 'test-secret', { expiresIn: '1h' });
    http.post.mockReturnValue(of({ data: { token, user: { id: 'u1', email: 'a@b.com' } } }));
    const res = fakeResponse();

    await controller.login({ email: 'a@b.com', password: 'pw' } as any, fakeRequest(), res);
    await controller.logout(res);

    const setOpts = res.cookie.mock.calls[0][2];
    const clearOpts = res.clearCookie.mock.calls[0][1];
    // Express silently ignores a clearCookie whose attributes don't match the
    // set — the user would stay logged in with no error anywhere.
    for (const attr of ['httpOnly', 'sameSite', 'path', 'secure']) {
      expect(clearOpts[attr]).toEqual(setOpts[attr]);
    }
  });

  it('marks the cookie secure only in production', async () => {
    const { controller, http } = setup();
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com' }, 'test-secret', { expiresIn: '1h' });
    http.post.mockReturnValue(of({ data: { token, user: { id: 'u1', email: 'a@b.com' } } }));

    process.env.NODE_ENV = 'production';
    const prodRes = fakeResponse();
    await controller.login({ email: 'a@b.com', password: 'pw' } as any, fakeRequest(), prodRes);
    expect(prodRes.cookie.mock.calls[0][2].secure).toBe(true);

    process.env.NODE_ENV = 'development';
    const devRes = fakeResponse();
    await controller.login({ email: 'a@b.com', password: 'pw' } as any, fakeRequest(), devRes);
    expect(devRes.cookie.mock.calls[0][2].secure).toBe(false);
  });

  it('surfaces a downstream 401 as 401, not a blanket 500', async () => {
    const { controller, http } = setup();
    http.post.mockReturnValue(
      throwError(() => axiosFailure(401, { statusCode: 401, message: 'Invalid email or password' })),
    );

    await expect(
      controller.login({ email: 'a@b.com', password: 'wrong' } as any, fakeRequest(), fakeResponse()),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('never leaks the submitted password when login fails', async () => {
    const { controller, http } = setup();
    http.post.mockReturnValue(
      throwError(() => axiosFailure(401, { statusCode: 401, message: 'Invalid email or password' })),
    );

    const err = await controller
      .login({ email: 'a@b.com', password: 'supersecret' } as any, fakeRequest(), fakeResponse())
      .catch((e) => e);

    expect(JSON.stringify(err.getResponse())).not.toContain('supersecret');
  });

  it('does not set a cookie when the downstream call fails', async () => {
    const { controller, http } = setup();
    const res = fakeResponse();
    http.post.mockReturnValue(throwError(() => axiosFailure(401, { message: 'nope' })));

    await controller
      .login({ email: 'a@b.com', password: 'wrong' } as any, fakeRequest(), res)
      .catch(() => undefined);

    expect(res.cookie).not.toHaveBeenCalled();
  });
});
