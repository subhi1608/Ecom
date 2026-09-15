import {
  BadRequestException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function setup() {
  const reply = jest.fn();
  const httpAdapterHost: any = {
    httpAdapter: { getRequestUrl: () => '/auth/login', reply },
  };
  const host: any = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ headers: {}, method: 'POST' }),
      getResponse: () => ({}),
    }),
  };
  const filter = new AllExceptionsFilter(httpAdapterHost);
  // Silence the intentional server-side error logging during tests.
  jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined);
  return { filter, host, reply };
}

function bodyFor(exception: unknown) {
  const { filter, host, reply } = setup();
  filter.catch(exception, host);
  return reply.mock.calls[0][1];
}

describe('AllExceptionsFilter response shape', () => {
  it('flattens a Nest exception to a STRING message, not a nested object', () => {
    // getResponse() returns { message, error, statusCode } for built-in
    // exceptions. Embedding that whole object under `message` is what made
    // the UI render "[object Object]" instead of the reason.
    const body = bodyFor(new UnauthorizedException('Invalid email or password'));

    expect(body.statusCode).toBe(401);
    expect(body.message).toBe('Invalid email or password');
  });

  it('flattens the {statusCode, message} shape that translateProxyError builds', () => {
    // The gateway rebuilds downstream errors in this shape. Left unflattened,
    // it double-nests on the way back out.
    const body = bodyFor(
      new HttpException({ statusCode: 401, message: 'Invalid email or password' }, 401),
    );

    expect(body.message).toBe('Invalid email or password');
  });

  it('preserves the ARRAY of validation errors rather than collapsing it', () => {
    // The UI joins these with ", " — flattening to a single string here
    // would lose the per-field detail.
    const body = bodyFor(
      new BadRequestException(['productId must be a string', 'quantity must not be less than 1']),
    );

    expect(body.message).toEqual([
      'productId must be a string',
      'quantity must not be less than 1',
    ]);
  });

  it('passes through a plain string message', () => {
    const body = bodyFor(new HttpException('Straight up string', 418));

    expect(body.message).toBe('Straight up string');
  });

  it('never leaks internal detail for a non-HTTP exception', () => {
    const body = bodyFor(new Error('connection string with a password in it'));

    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
  });

  it('still carries path and timestamp', () => {
    const body = bodyFor(new UnauthorizedException('nope'));

    expect(body.path).toBe('/auth/login');
    expect(typeof body.timestamp).toBe('string');
  });
});
