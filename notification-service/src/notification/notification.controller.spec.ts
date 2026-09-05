import { NotificationController } from './notification.controller';

describe('NotificationController', () => {
  function setup(sendResult: boolean) {
    const notificationService: any = {
      sendOrderConfirmation: jest.fn().mockResolvedValue(sendResult),
    };
    const publisher: any = { publishToQueue: jest.fn() };
    const controller = new NotificationController(notificationService, publisher);
    return { controller, notificationService, publisher };
  }

  const baseMessage = {
    correlationId: 'corr-1',
    data: { orderId: 'order-1', customerEmail: 'a@b.com' },
  };

  it('does not publish to any queue when the send succeeds', async () => {
    const { controller, publisher } = setup(true);

    await controller.handlePaymentCompleted(baseMessage);

    expect(publisher.publishToQueue).not.toHaveBeenCalled();
  });

  it('publishes to the retry queue with an incremented retry count on failure, under the limit', async () => {
    const { controller, publisher } = setup(false);

    await controller.handlePaymentCompleted({
      ...baseMessage,
      retryCount: 1,
    } as any);

    expect(publisher.publishToQueue).toHaveBeenCalledWith('events_queue.retry', 'payment_completed', {
      correlationId: 'corr-1',
      data: baseMessage.data,
      retryCount: 2,
    });
  });

  it('publishes to the DLQ instead of retrying once the limit is reached', async () => {
    const { controller, publisher } = setup(false);

    await controller.handlePaymentCompleted({
      ...baseMessage,
      retryCount: 3,
    } as any);

    expect(publisher.publishToQueue).toHaveBeenCalledWith('events_queue.dlq', 'payment_completed', {
      correlationId: 'corr-1',
      data: baseMessage.data,
      retryCount: 4,
    });
  });
});
