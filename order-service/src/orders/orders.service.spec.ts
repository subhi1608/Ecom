import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';

describe('OrdersService', () => {
  function setup() {
    const order = {
      id: 'order-1',
      productId: 'prod-1',
      quantity: 2,
      customerEmail: 'a@b.com',
      status: OrderStatus.PENDING,
    };
    const orderRepo: any = {
      create: jest.fn().mockReturnValue(order),
      save: jest.fn().mockResolvedValue(order),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    const client: any = { connect: jest.fn(), emit: jest.fn() };
    const service = new OrdersService(orderRepo, client);
    return { service, orderRepo, client, order };
  }

  it('wraps the order_created event in a correlationId envelope', async () => {
    const { service, client, order } = setup();

    await service.createOrder(
      { productId: 'prod-1', quantity: 2, customerEmail: 'a@b.com' },
      'corr-123',
    );

    expect(client.emit).toHaveBeenCalledWith('order_created', {
      correlationId: 'corr-123',
      data: {
        orderId: order.id,
        productId: order.productId,
        quantity: order.quantity,
        customerEmail: order.customerEmail,
      },
    });
  });

  it('throws NotFoundException when the order does not exist', async () => {
    const { service, orderRepo } = setup();
    orderRepo.findOne.mockResolvedValue(null);

    await expect(service.getOrder('missing-id')).rejects.toThrow(NotFoundException);
  });
});
