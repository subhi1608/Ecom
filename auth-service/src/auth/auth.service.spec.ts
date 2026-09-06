import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { QueryFailedError } from 'typeorm';
import { AuthService } from './auth.service';

describe('AuthService.register', () => {
  function setup() {
    const userRepo: any = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => data),
      save: jest.fn(async (user) => ({ ...user, id: 'user-1' })),
    };
    const service = new AuthService(userRepo);
    return { service, userRepo };
  }

  it('stores a bcrypt hash, never the plaintext password', async () => {
    const { service, userRepo } = setup();

    await service.register({ email: 'a@b.com', password: 'supersecret' });

    const saved = userRepo.save.mock.calls[0][0];
    expect(saved.passwordHash).toBeDefined();
    expect(saved.passwordHash).not.toBe('supersecret');
    expect(await bcrypt.compare('supersecret', saved.passwordHash)).toBe(true);
  });

  it('does not return the password hash to the caller', async () => {
    const { service } = setup();

    const result = await service.register({ email: 'a@b.com', password: 'supersecret' });

    expect(result).toEqual({ id: 'user-1', email: 'a@b.com' });
    expect((result as any).passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email with ConflictException', async () => {
    const { service, userRepo } = setup();
    userRepo.findOne.mockResolvedValue({ id: 'existing', email: 'a@b.com' });

    await expect(
      service.register({ email: 'a@b.com', password: 'supersecret' }),
    ).rejects.toThrow(ConflictException);
  });

  it('converts a race-lost unique-constraint violation on save into ConflictException', async () => {
    const { service, userRepo } = setup();
    const conflictError = Object.assign(
      new QueryFailedError('insert', [], new Error('duplicate key')),
      { code: '23505' },
    );
    userRepo.save.mockRejectedValue(conflictError);

    await expect(
      service.register({ email: 'a@b.com', password: 'supersecret' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('AuthService.login', () => {
  const JWT_SECRET = 'test-secret';

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_EXPIRES_IN = '1h';
  });

  async function setupLogin(password = 'supersecret') {
    const passwordHash = await bcrypt.hash(password, 10);
    const userRepo: any = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash,
      }),
    };
    const service = new AuthService(userRepo);
    return { service, userRepo };
  }

  it('returns a signed JWT carrying sub, email and an expiry', async () => {
    const { service } = await setupLogin();

    const result = await service.login({ email: 'a@b.com', password: 'supersecret' });

    const claims = jwt.verify(result.token, JWT_SECRET) as jwt.JwtPayload;
    expect(claims.sub).toBe('user-1');
    expect(claims.email).toBe('a@b.com');
    expect(claims.exp).toBeGreaterThan(claims.iat!);
    expect(result.user).toEqual({ id: 'user-1', email: 'a@b.com' });
  });

  it('rejects a wrong password with UnauthorizedException', async () => {
    const { service } = await setupLogin();

    await expect(
      service.login({ email: 'a@b.com', password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unknown email with the same error as a wrong password', async () => {
    const { service, userRepo } = await setupLogin();
    userRepo.findOne.mockResolvedValue(null);

    // The message must not reveal whether the account exists — otherwise the
    // endpoint becomes an account-enumeration oracle.
    await expect(
      service.login({ email: 'nobody@b.com', password: 'supersecret' }),
    ).rejects.toThrow('Invalid email or password');
  });
});
