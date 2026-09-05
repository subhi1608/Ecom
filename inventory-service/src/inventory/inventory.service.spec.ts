import { NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ReservationStatus } from './entities/inventory.entity';

describe('InventoryService', () => {
  function setup(existingReservation: any, item: any) {
    const queryBuilder: any = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(item),
    };
    const manager: any = {
      findOne: jest.fn().mockResolvedValue(existingReservation),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      save: jest.fn(),
    };
    const dataSource: any = {
      transaction: jest.fn(async (cb) => cb(manager)),
    };
    const client: any = { connect: jest.fn(), emit: jest.fn() };
    const service = new InventoryService(client, dataSource);
    return { service, client, manager };
  }

  it('wraps stock_reserved in a correlationId envelope, forwarding the same id', async () => {
    const { service, client } = setup(null, { productId: 'prod-1', availableStock: 10 });

    await service.reserveStock(
      { orderId: 'order-1', productId: 'prod-1', quantity: 2, customerEmail: 'a@b.com' },
      'corr-123',
    );

    expect(client.emit).toHaveBeenCalledWith('stock_reserved', {
      correlationId: 'corr-123',
      data: {
        orderId: 'order-1',
        productId: 'prod-1',
        quantity: 2,
        customerEmail: 'a@b.com',
      },
    });
  });

  it('wraps stock_failed in a correlationId envelope when stock is insufficient', async () => {
    const { service, client } = setup(null, { productId: 'prod-1', availableStock: 1 });

    await service.reserveStock(
      { orderId: 'order-1', productId: 'prod-1', quantity: 2, customerEmail: 'a@b.com' },
      'corr-456',
    );

    expect(client.emit).toHaveBeenCalledWith('stock_failed', {
      correlationId: 'corr-456',
      data: { orderId: 'order-1', reason: 'insufficient_stock' },
    });
  });
});

describe('InventoryService.getStock', () => {
  function setupGetStock(item: any) {
    const repo: any = { findOne: jest.fn().mockResolvedValue(item) };
    const dataSource: any = { getRepository: jest.fn().mockReturnValue(repo) };
    const client: any = { connect: jest.fn(), emit: jest.fn() };
    const service = new InventoryService(client, dataSource);
    return { service, repo };
  }

  it('returns the product\'s current stock', async () => {
    const { service } = setupGetStock({ productId: 'prod-1', availableStock: 42 });

    const result = await service.getStock('prod-1');

    expect(result).toEqual({ productId: 'prod-1', availableStock: 42 });
  });

  it('throws NotFoundException when the product does not exist', async () => {
    const { service } = setupGetStock(null);

    await expect(service.getStock('missing')).rejects.toThrow(NotFoundException);
  });
});
