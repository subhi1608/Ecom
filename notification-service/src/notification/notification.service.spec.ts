import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs success and returns true when the mock send succeeds', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99); // > 0.1 -> success
    const service = new NotificationService();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await service.sendOrderConfirmation(
      { orderId: 'order-1', customerEmail: 'a@b.com' },
      'corr-123',
    );

    expect(result).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('corr-123'));
  });

  it('logs failure and returns false when the mock send fails', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.01); // <= 0.1 -> failure
    const service = new NotificationService();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await service.sendOrderConfirmation(
      { orderId: 'order-1', customerEmail: 'a@b.com' },
      'corr-123',
    );

    expect(result).toBe(false);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('corr-123'));
  });
});
