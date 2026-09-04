import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns a static ok status from /health', () => {
    const controller = new HealthController();
    expect(controller.checkHealth()).toEqual({ status: 'ok' });
  });

  it('returns a static ok status from /ready (no dependencies to check)', () => {
    const controller = new HealthController();
    expect(controller.checkReady()).toEqual({ status: 'ok' });
  });
});
