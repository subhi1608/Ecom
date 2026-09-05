import { InventoryController } from './inventory.controller';

describe('InventoryController', () => {
  function setup() {
    const inventoryService: any = {
      reserveStock: jest.fn(),
      releaseStock: jest.fn(),
      getStock: jest.fn(),
    };
    const controller = new InventoryController(inventoryService);
    return { controller, inventoryService };
  }

  it('handles order_cancelled by releasing the reservation', async () => {
    const { controller, inventoryService } = setup();

    await controller.handleOrderCancelled({
      correlationId: 'corr-1',
      data: { orderId: 'order-1', productId: 'prod-1', quantity: 2 } as any,
    });

    expect(inventoryService.releaseStock).toHaveBeenCalledWith('order-1', 'corr-1');
  });

  it('returns stock for a known product on GET /:productId', async () => {
    const { controller, inventoryService } = setup();
    inventoryService.getStock.mockResolvedValue({ productId: 'prod-1', availableStock: 5 });

    const result = await controller.getStock('prod-1');

    expect(inventoryService.getStock).toHaveBeenCalledWith('prod-1');
    expect(result).toEqual({ productId: 'prod-1', availableStock: 5 });
  });

  it('acks the message when reserveStock succeeds', async () => {
    const { controller, inventoryService } = setup();
    inventoryService.reserveStock = jest.fn().mockResolvedValue(undefined);
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const context: any = {
      getChannelRef: () => channel,
      getMessage: () => 'the-message',
    };

    await controller.handleOrderCreated(
      { correlationId: 'corr-1', data: { orderId: 'order-1', productId: 'prod-1', quantity: 1, customerEmail: 'a@b.com' } },
      context,
    );

    expect(channel.ack).toHaveBeenCalledWith('the-message');
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('nacks (no requeue) the message when reserveStock throws', async () => {
    const { controller, inventoryService } = setup();
    inventoryService.reserveStock = jest.fn().mockRejectedValue(new Error('db connection lost'));
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const context: any = {
      getChannelRef: () => channel,
      getMessage: () => 'the-message',
    };

    await controller.handleOrderCreated(
      { correlationId: 'corr-1', data: { orderId: 'order-1', productId: 'prod-1', quantity: 1, customerEmail: 'a@b.com' } },
      context,
    );

    expect(channel.nack).toHaveBeenCalledWith('the-message', false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });
});
