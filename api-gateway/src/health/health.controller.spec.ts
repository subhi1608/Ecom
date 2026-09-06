import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns a static ok status from /health', () => {
    const health: any = { check: jest.fn() };
    const http: any = { pingCheck: jest.fn() };
    const controller = new HealthController(health, http);
    expect(controller.checkHealth()).toEqual({ status: 'ok' });
  });

  it('delegates /ready to HealthCheckService with an order-service ping check', async () => {
    const http: any = { pingCheck: jest.fn().mockResolvedValue({ 'order-service': { status: 'up' } }) };
    const health: any = {
      check: jest.fn(async (indicators: Array<() => Promise<unknown>>) => {
        const results = await Promise.all(indicators.map((fn) => fn()));
        return { status: 'ok', info: {}, error: {}, details: Object.assign({}, ...results) };
      }),
    };
    const controller = new HealthController(health, http);

    await controller.checkReady();

    expect(health.check).toHaveBeenCalledWith([expect.any(Function)]);
    expect(http.pingCheck).toHaveBeenCalledWith(
      'order-service',
      expect.stringContaining('/health'),
      { timeout: 3000 },
    );
  });
});

import { JwtAuthGuard } from '../common/jwt-auth.guard';

describe('HealthController is not behind auth', () => {
  it('has no JwtAuthGuard applied, so orchestrator probes need no credentials', () => {
    // Guards are per-controller here; this asserts nobody later blanket-
    // applies JwtAuthGuard globally and silently breaks liveness probes.
    const controllerGuards = Reflect.getMetadata('__guards__', HealthController) || [];
    const methodGuards = [
      Reflect.getMetadata('__guards__', HealthController.prototype.checkHealth) || [],
      Reflect.getMetadata('__guards__', HealthController.prototype.checkReady) || [],
    ].flat();

    expect([...controllerGuards, ...methodGuards]).not.toContain(JwtAuthGuard);
  });
});
