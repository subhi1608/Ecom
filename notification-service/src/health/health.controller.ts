import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  checkHealth() {
    return { status: 'ok' };
  }

  // notification-service has no database or downstream dependency to check —
  // readiness here is equivalent to liveness by design (see spec §3).
  @Get('ready')
  checkReady() {
    return { status: 'ok' };
  }
}
