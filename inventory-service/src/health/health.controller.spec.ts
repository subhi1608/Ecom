import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns a static ok status from /health', () => {
    const health: any = { check: jest.fn() };
    const db: any = { pingCheck: jest.fn() };
    const controller = new HealthController(health, db);
    expect(controller.checkHealth()).toEqual({ status: 'ok' });
  });

  it('delegates /ready to HealthCheckService with a database ping check', async () => {
    const db: any = { pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) };
    const health: any = {
      check: jest.fn(async (indicators: Array<() => Promise<unknown>>) => {
        const results = await Promise.all(indicators.map((fn) => fn()));
        return { status: 'ok', info: {}, error: {}, details: Object.assign({}, ...results) };
      }),
    };
    const controller = new HealthController(health, db);

    await controller.checkReady();

    expect(health.check).toHaveBeenCalledWith([expect.any(Function)]);
    expect(db.pingCheck).toHaveBeenCalledWith('database');
  });
});
