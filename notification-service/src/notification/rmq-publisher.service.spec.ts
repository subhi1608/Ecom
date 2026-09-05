import { RmqPublisherService } from './rmq-publisher.service';

describe('RmqPublisherService', () => {
  it('publishes a {pattern, data} JSON packet to the given queue', () => {
    const service = new RmqPublisherService();
    const sendToQueue = jest.fn();
    // @ts-expect-error - reaching into the private field to inject a test double
    service['channel'] = { sendToQueue };

    service.publishToQueue('events_queue.retry', 'payment_completed', { orderId: 'order-1' });

    expect(sendToQueue).toHaveBeenCalledWith(
      'events_queue.retry',
      Buffer.from(JSON.stringify({ pattern: 'payment_completed', data: { orderId: 'order-1' } })),
      { persistent: true },
    );
  });

  it('throws if called before the channel is initialized', () => {
    const service = new RmqPublisherService();
    expect(() => service.publishToQueue('events_queue.retry', 'payment_completed', {})).toThrow();
  });
});
