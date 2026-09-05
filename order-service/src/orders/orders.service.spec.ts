import { NotFoundException, ConflictException } from '@nestjs/common';
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

describe('OrdersService.listOrders', () => {
  function setupList() {
    const orders = [{ id: 'order-1' }, { id: 'order-2' }];
    const orderRepo: any = {
      findAndCount: jest.fn().mockResolvedValue([orders, 2]),
    };
    const client: any = { connect: jest.fn(), emit: jest.fn() };
    const service = new OrdersService(orderRepo, client);
    return { service, orderRepo };
  }

  it('applies default pagination when no filters are given', async () => {
    const { service, orderRepo } = setupList();

    const result = await service.listOrders({});

    expect(orderRepo.findAndCount).toHaveBeenCalledWith({
      where: {},
      skip: 0,
      take: 20,
    });
    expect(result).toEqual({ data: [{ id: 'order-1' }, { id: 'order-2' }], total: 2, page: 1, limit: 20 });
  });

  it('applies status and customerEmail filters, custom page/limit', async () => {
    const { service, orderRepo } = setupList();

    await service.listOrders({
      status: OrderStatus.FULFILLED,
      customerEmail: 'a@b.com',
      page: 3,
      limit: 10,
    });

    expect(orderRepo.findAndCount).toHaveBeenCalledWith({
      where: { status: OrderStatus.FULFILLED, customerEmail: 'a@b.com' },
      skip: 20,
      take: 10,
    });
  });

  it('caps limit at 100 even if a larger value is requested', async () => {
    const { service, orderRepo } = setupList();

    await service.listOrders({ limit: 500 });

    expect(orderRepo.findAndCount).toHaveBeenCalledWith({
      where: {},
      skip: 0,
      take: 100,
    });
  });
});

describe('OrdersService.cancelOrder', () => {
  function setupCancel(existingOrder: any) {
    const orderRepo: any = {
      findOne: jest.fn().mockResolvedValue(existingOrder),
      update: jest.fn(),
    };
    const client: any = { connect: jest.fn(), emit: jest.fn() };
    const service = new OrdersService(orderRepo, client);
    return { service, orderRepo, client };
  }

  it('cancels a PENDING order and emits order_cancelled', async () => {
    const { service, orderRepo, client } = setupCancel({
      id: 'order-1',
      productId: 'prod-1',
      quantity: 2,
      status: OrderStatus.PENDING,
    });

    await service.cancelOrder('order-1', 'corr-123');

    expect(orderRepo.update).toHaveBeenCalledWith('order-1', { status: OrderStatus.CANCELLED });
    expect(client.emit).toHaveBeenCalledWith('order_cancelled', {
      correlationId: 'corr-123',
      data: { orderId: 'order-1', productId: 'prod-1', quantity: 2 },
    });
  });

  it('throws ConflictException when the order is not PENDING', async () => {
    const { service } = setupCancel({
      id: 'order-2',
      productId: 'prod-1',
      quantity: 1,
      status: OrderStatus.FULFILLED,
    });

    await expect(service.cancelOrder('order-2', 'corr-456')).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when the order does not exist', async () => {
    const { service } = setupCancel(null);

    await expect(service.cancelOrder('missing-id', 'corr-789')).rejects.toThrow(NotFoundException);
  });
});
