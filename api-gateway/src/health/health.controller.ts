import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HttpHealthIndicator } from '@nestjs/terminus';

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || 'http://localhost:3001';

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
