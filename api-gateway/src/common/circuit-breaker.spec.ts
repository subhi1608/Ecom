import { ServiceUnavailableException } from '@nestjs/common';
import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('passes calls through while under the failure threshold', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });

    const result = await breaker.execute(() => Promise.resolve('ok'));

    expect(result).toBe('ok');
  });

  it('opens after reaching the failure threshold and short-circuits further calls', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });
    const failing = () => Promise.reject(new Error('downstream down'));

    await expect(breaker.execute(failing)).rejects.toThrow('downstream down');
    await expect(breaker.execute(failing)).rejects.toThrow('downstream down');

    // Third call should be short-circuited without invoking the downstream fn at all.
    const fn = jest.fn().mockResolvedValue('should not run');
    await expect(breaker.execute(fn)).rejects.toThrow(ServiceUnavailableException);
    expect(fn).not.toHaveBeenCalled();
  });

  it('moves to half-open after the reset timeout and closes again on success', async () => {
    jest.useFakeTimers();
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 5000 });
    const failing = () => Promise.reject(new Error('down'));

    await expect(breaker.execute(failing)).rejects.toThrow('down');
    // Circuit is OPEN now — immediate retry short-circuits.
    await expect(breaker.execute(() => Promise.resolve('x'))).rejects.toThrow(
      ServiceUnavailableException,
    );

    jest.advanceTimersByTime(5001);

    // Half-open: this call is allowed through, and success closes the circuit.
    const result = await breaker.execute(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');

    const result2 = await breaker.execute(() => Promise.resolve('still closed'));
    expect(result2).toBe('still closed');

    jest.useRealTimers();
  });

  it('lets only one probe through when multiple calls arrive at once after the reset timeout', async () => {
    jest.useFakeTimers();
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 5000 });

    await expect(breaker.execute(() => Promise.reject(new Error('down')))).rejects.toThrow();
    jest.advanceTimersByTime(5001);

    let inFlight = 0;
    let maxConcurrent = 0;
    const slowProbe = () => {
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      return new Promise((resolve) => {
        setTimeout(() => {
          inFlight -= 1;
          resolve('ok');
        }, 100);
      });
    };

    const attempts = [
      breaker.execute(slowProbe).catch((e) => e),
      breaker.execute(slowProbe).catch((e) => e),
      breaker.execute(slowProbe).catch((e) => e),
    ];
    await jest.advanceTimersByTimeAsync(200);
    const results = await Promise.all(attempts);

    expect(maxConcurrent).toBe(1);
    const rejectedCount = results.filter((r) => r instanceof ServiceUnavailableException).length;
    expect(rejectedCount).toBe(2);

    jest.useRealTimers();
  });
});

describe('CircuitBreaker isFailure predicate', () => {
  it('does not trip on errors the predicate excludes', async () => {
    // A downstream 404 proves the dependency is HEALTHY — it answered. If
    // such responses counted as failures, five lookups of a non-existent
    // order would open the circuit and take the endpoint down for everyone.
    const notFound = Object.assign(new Error('not found'), { status: 404 });
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
      isFailure: (err: any) => err.status !== 404,
    });

    for (let i = 0; i < 5; i++) {
      await expect(breaker.execute(() => Promise.reject(notFound))).rejects.toThrow('not found');
    }

    // Circuit must still be closed: a real call gets through.
    await expect(breaker.execute(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('still trips on errors the predicate counts', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
      isFailure: (err: any) => err.status !== 404,
    });
    const outage = Object.assign(new Error('ECONNREFUSED'), { status: undefined });

    await expect(breaker.execute(() => Promise.reject(outage))).rejects.toThrow('ECONNREFUSED');
    await expect(breaker.execute(() => Promise.reject(outage))).rejects.toThrow('ECONNREFUSED');

    const fn = jest.fn().mockResolvedValue('should not run');
    await expect(breaker.execute(fn)).rejects.toThrow(ServiceUnavailableException);
    expect(fn).not.toHaveBeenCalled();
  });

  it('counts every error as a failure when no predicate is supplied', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });

    await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    const fn = jest.fn().mockResolvedValue('nope');
    await expect(breaker.execute(fn)).rejects.toThrow(ServiceUnavailableException);
    expect(fn).not.toHaveBeenCalled();
  });
});
