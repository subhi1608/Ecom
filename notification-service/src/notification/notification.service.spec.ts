import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  it('logs the correlation id alongside the order id and email', async () => {
    const service = new NotificationService();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await service.sendOrderConfirmation(
      { orderId: 'order-1', customerEmail: 'a@b.com' },
      'corr-123',
    );

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('corr-123'));
    logSpy.mockRestore();
  });
});
