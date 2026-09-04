import { PaymentService } from './payment.service';
import { PaymentStatus } from './entities/payment.entity';

describe('PaymentService', () => {
  function setup() {
    const repo: any = { insert: jest.fn().mockResolvedValue(undefined) };
    const dataSource: any = {
      connect: undefined,
      getRepository: jest.fn().mockReturnValue(repo),
    };
    const client: any = { connect: jest.fn(), emit: jest.fn() };
    const service = new PaymentService(client, dataSource);
    // Force a deterministic outcome instead of relying on Math.random.
    jest.spyOn(Math, 'random').mockReturnValue(0.99); // > 0.15 -> COMPLETED
    return { service, client, repo };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('wraps payment_completed in a correlationId envelope on success', async () => {
    const { service, client } = setup();

    await service.processPayment(
      { orderId: 'order-1', productId: 'prod-1', quantity: 2, customerEmail: 'a@b.com' },
      'corr-123',
    );

    expect(client.emit).toHaveBeenCalledWith('payment_completed', {
      correlationId: 'corr-123',
      data: { orderId: 'order-1', customerEmail: 'a@b.com' },
    });
  });

  it('wraps payment_failed in a correlationId envelope on decline', async () => {
    const { service, client } = setup();
    jest.spyOn(Math, 'random').mockReturnValue(0.01); // <= 0.15 -> FAILED

    await service.processPayment(
      { orderId: 'order-2', productId: 'prod-1', quantity: 1, customerEmail: 'a@b.com' },
      'corr-456',
    );

    expect(client.emit).toHaveBeenCalledWith('payment_failed', {
      correlationId: 'corr-456',
      data: { orderId: 'order-2', reason: 'payment_declined' },
    });
  });
});
