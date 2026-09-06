import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { isDownstreamClientError, translateProxyError } from './proxy-error';

function axiosError(status: number, data: unknown, withPassword = false) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    // Axios attaches the ORIGINAL REQUEST BODY here. For a login that means
    // the submitted password. It must never reach a client or a log.
    config: withPassword
      ? { data: JSON.stringify({ email: 'a@b.com', password: 'supersecret' }) }
      : {},
    response: { status, data },
  };
}

describe('translateProxyError', () => {
  it('preserves the downstream status instead of collapsing it to 500', () => {
    const err = axiosError(401, { statusCode: 401, message: 'Invalid email or password' });

    const translated = translateProxyError(err);

    expect(translated).toBeInstanceOf(HttpException);
    expect((translated as HttpException).getStatus()).toBe(401);
  });

  it('preserves a downstream 404 so ownership checks surface correctly', () => {
    const err = axiosError(404, { statusCode: 404, message: 'Order abc not found' });

    expect((translateProxyError(err) as HttpException).getStatus()).toBe(404);
  });

  it('never leaks the submitted password from the axios request config', () => {
    const err = axiosError(401, { statusCode: 401, message: 'Invalid email or password' }, true);

    const serialised = JSON.stringify(
      (translateProxyError(err) as HttpException).getResponse(),
    );

    // The user-facing message legitimately contains the WORD 'password'
    // ('Invalid email or password'). What must never escape is the submitted
    // VALUE, nor any trace of the axios request config that carried it.
    expect(serialised).not.toContain('supersecret');
    expect(serialised).not.toContain('config');
  });

  it('does not pass through unexpected downstream body fields', () => {
    const err = axiosError(400, {
      statusCode: 400,
      message: 'Bad request',
      internalStackTrace: 'at SomeInternalThing (/srv/secret.js:42)',
    });

    const serialised = JSON.stringify(
      (translateProxyError(err) as HttpException).getResponse(),
    );

    expect(serialised).toContain('Bad request');
    expect(serialised).not.toContain('internalStackTrace');
    expect(serialised).not.toContain('secret.js');
  });

  it('maps a no-response failure (connection refused / timeout) to 503', () => {
    const translated = translateProxyError(new Error('timeout of 5000ms exceeded'));

    expect(translated).toBeInstanceOf(ServiceUnavailableException);
  });

  it('passes an existing HttpException straight through untouched', () => {
    // The CircuitBreaker throws ServiceUnavailableException itself when open —
    // re-wrapping it would lose that meaning.
    const original = new ServiceUnavailableException('circuit open');

    expect(translateProxyError(original)).toBe(original);
  });
});

describe('isDownstreamClientError', () => {
  it('treats a 4xx as a client error — the downstream is healthy', () => {
    expect(isDownstreamClientError(axiosError(404, {}))).toBe(true);
    expect(isDownstreamClientError(axiosError(409, {}))).toBe(true);
  });

  it('does not treat a 5xx as a client error', () => {
    expect(isDownstreamClientError(axiosError(500, {}))).toBe(false);
  });

  it('does not treat a connection failure as a client error', () => {
    expect(isDownstreamClientError(new Error('ECONNREFUSED'))).toBe(false);
  });
});

describe('isDownstreamClientError after translation', () => {
  it('recognises an already-translated HttpException carrying a 4xx', () => {
    // Order matters: the controller translates the axios error BEFORE the
    // circuit breaker's predicate sees it, so the predicate must recognise
    // the translated shape too — otherwise 404s silently trip the breaker.
    const translated = translateProxyError(
      { isAxiosError: true, response: { status: 404, data: { message: 'nope' } } },
    );

    expect(isDownstreamClientError(translated)).toBe(true);
  });

  it('does not treat a translated 503 as a client error', () => {
    const translated = translateProxyError(new Error('ECONNREFUSED'));

    expect(isDownstreamClientError(translated)).toBe(false);
  });
});
