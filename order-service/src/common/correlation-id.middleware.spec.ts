import { CorrelationIdMiddleware } from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  function mockReqRes(headers: Record<string, string> = {}) {
    const req: any = { headers };
    const res: any = { setHeader: jest.fn() };
    const next = jest.fn();
    return { req, res, next };
  }

  it('generates a correlation id when none is provided', () => {
    const { req, res, next } = mockReqRes();
    middleware.use(req, res, next);
    expect(typeof req.correlationId).toBe('string');
    expect(req.correlationId.length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', req.correlationId);
    expect(next).toHaveBeenCalled();
  });

  it('preserves an existing correlation id header instead of generating a new one', () => {
    const { req, res, next } = mockReqRes({ 'x-correlation-id': 'existing-id-123' });
    middleware.use(req, res, next);
    expect(req.correlationId).toBe('existing-id-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'existing-id-123');
    expect(next).toHaveBeenCalled();
  });
});
