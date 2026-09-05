import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HttpHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || 'http://localhost:3001';

// Health/readiness probes are exempt from rate limiting — an orchestrator
// polling these on a tight interval should never trip the gateway's limiter.
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
  ) {}

  @Get('health')
  checkHealth() {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  checkReady() {
    return this.health.check([
      () =>
        this.http.pingCheck('order-service', `${ORDER_SERVICE_URL}/health`, {
          timeout: 3000,
        }),
    ]);
  }
}
