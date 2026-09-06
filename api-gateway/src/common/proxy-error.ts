import { HttpException, ServiceUnavailableException } from '@nestjs/common';

interface DownstreamErrorShape {
  isAxiosError?: boolean;
  response?: { status?: number; data?: unknown };
}

function hasDownstreamResponse(
  err: unknown,
): err is DownstreamErrorShape & { response: { status: number; data?: unknown } } {
  const candidate = err as DownstreamErrorShape;
  return typeof candidate?.response?.status === 'number';
}

// True when the downstream answered with a 4xx. That means the dependency is
// healthy and doing its job — it just rejected THIS request. Callers use this
// to keep such responses from counting as circuit-breaker failures: five
// lookups of a non-existent order must not trip the breaker and take the
// whole endpoint down for everyone.
export function isDownstreamClientError(err: unknown): boolean {
  // Callers translate before the circuit breaker's predicate runs, so this
  // must recognise BOTH the raw axios shape and the translated
  // HttpException. Missing the translated form would let 404s trip the
  // breaker — the exact failure this helper exists to prevent.
  const status = err instanceof HttpException
    ? err.getStatus()
    : hasDownstreamResponse(err)
      ? err.response.status
      : undefined;

  return status !== undefined && status >= 400 && status < 500;
}

// Axios rejects with an AxiosError, which is NOT an HttpException — so the
// global AllExceptionsFilter flattens it to a blanket 500. That turned a
// wrong password into "500 Internal server error" and would have done the
// same to the 404 that enforces order ownership. Translate here so the real
// status survives the hop.
export function translateProxyError(err: unknown): unknown {
  // The CircuitBreaker throws ServiceUnavailableException itself when open,
  // and guards throw UnauthorizedException. Those already carry the right
  // status — re-wrapping would destroy their meaning.
  if (err instanceof HttpException) return err;

  if (hasDownstreamResponse(err)) {
    const body = err.response.data as Record<string, unknown> | undefined;
    const message =
      typeof body?.message === 'string' || Array.isArray(body?.message)
        ? body.message
        : 'Request failed';

    // Rebuild a fixed shape rather than forwarding the downstream body. An
    // axios error carries `config.data` — the original request payload, which
    // for a login is the user's PASSWORD — and downstream bodies may carry
    // internal detail. Only the message and status cross this boundary.
    return new HttpException(
      { statusCode: err.response.status, message },
      err.response.status,
    );
  }

  // No response at all: connection refused, DNS failure, or the rxjs
  // timeout() fired. The client should be able to tell an outage apart from
  // a credential rejection.
  return new ServiceUnavailableException(
    'Downstream service is unavailable or timed out',
  );
}
