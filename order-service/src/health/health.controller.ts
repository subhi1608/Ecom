import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, TypeOrmHealthIndicator } from '@nestjs/terminus';

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get('health')
  checkHealth() {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  checkReady() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
