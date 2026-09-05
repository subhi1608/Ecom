import { ServiceUnavailableException } from '@nestjs/common';

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

// A minimal circuit breaker: trips OPEN after `failureThreshold` consecutive
// failures, short-circuits every call while OPEN (no downstream call made at
// all), then after `resetTimeoutMs` allows exactly one HALF_OPEN probe —
// success closes it, failure re-opens it.
export class CircuitBreaker {
  private state: State = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt = 0;
  // Guards the OPEN→HALF_OPEN transition so that when several calls arrive
  // at once right after the reset timeout elapses, only the first becomes
  // the probe — the rest are still short-circuited until it resolves.
  private probeInFlight = false;

  constructor(private readonly options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // A concurrent call arriving while a HALF_OPEN probe is already in
    // flight must be blocked too — not just calls that still see OPEN —
    // since the first probe flips state to HALF_OPEN synchronously, before
    // it (or anyone) awaits anything.
    if (this.state === 'HALF_OPEN' && this.probeInFlight) {
      throw new ServiceUnavailableException(
        'Downstream service is unavailable (circuit open, probe in flight)',
      );
    }

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed < this.options.resetTimeoutMs) {
        throw new ServiceUnavailableException(
          'Downstream service is unavailable (circuit open)',
        );
      }
      this.state = 'HALF_OPEN';
      this.probeInFlight = true;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.probeInFlight = false;
  }

  private onFailure() {
    this.consecutiveFailures += 1;
    if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
    this.probeInFlight = false;
  }
}
