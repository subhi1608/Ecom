import { Injectable, Inject, OnModuleInit, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { InventoryItem, Reservation, ReservationStatus } from './entities/inventory.entity';

@Injectable()
export class InventoryService implements OnModuleInit {
  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.client.connect();
    await this.seedStock();
  }

  async reserveStock(
    data: {
      orderId: string;
      productId: string;
      quantity: number;
      customerEmail: string;
    },
    correlationId: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      // Idempotency: if this order already has a reservation, skip.
      // (A duplicate order_created event shouldn't reserve twice.)
      const existing = await manager.findOne(Reservation, {
        where: { orderId: data.orderId },
      });
      if (existing) {
        console.log(
          `[inventory-service] [${correlationId}] order ${data.orderId} already reserved, skipping`,
        );
        return;
      }

      // Lock the product row so two concurrent orders can't both read the
      // same availableStock and both decrement it below zero.
      const item = await manager
        .createQueryBuilder(InventoryItem, 'item')
        .setLock('pessimistic_write')
        .where('item.productId = :productId', { productId: data.productId })
        .getOne();

      if (!item || item.availableStock < data.quantity) {
        console.log(
          `[inventory-service] [${correlationId}] insufficient stock for order ${data.orderId}`,
        );
        this.client.emit('stock_failed', {
          correlationId,
          data: { orderId: data.orderId, reason: 'insufficient_stock' },
        });
        return;
      }

      item.availableStock -= data.quantity;
      await manager.save(item);

      await manager.save(Reservation, {
        orderId: data.orderId,
        productId: data.productId,
        quantity: data.quantity,
        status: ReservationStatus.RESERVED,
      });

      console.log(
        `[inventory-service] [${correlationId}] reserved ${data.quantity}x ${data.productId} for order ${data.orderId}`,
      );

      this.client.emit('stock_reserved', {
        correlationId,
        data: {
          orderId: data.orderId,
          productId: data.productId,
          quantity: data.quantity,
          customerEmail: data.customerEmail,
        },
      });
    });
  }

  async releaseStock(orderId: string, correlationId: string) {
    await this.dataSource.transaction(async (manager) => {
      const reservation = await manager
        .createQueryBuilder(Reservation, 'r')
        .setLock('pessimistic_write')
        .where('r.orderId = :orderId', { orderId })
        .getOne();

      // Only release a reservation that's still active — guards against a
      // duplicate payment_failed event releasing stock twice.
      if (!reservation || reservation.status === ReservationStatus.RELEASED) {
        return;
      }

      const item = await manager
        .createQueryBuilder(InventoryItem, 'item')
        .setLock('pessimistic_write')
        .where('item.productId = :productId', { productId: reservation.productId })
        .getOne();

      if (item) {
        item.availableStock += reservation.quantity;
        await manager.save(item);
      }

      reservation.status = ReservationStatus.RELEASED;
      await manager.save(reservation);

      console.log(
        `[inventory-service] [${correlationId}] released ${reservation.quantity}x ${reservation.productId} for failed order ${orderId}`,
      );
    });
  }

  async getStock(productId: string) {
    const item = await this.dataSource.getRepository(InventoryItem).findOne({
      where: { productId },
    });
    if (!item) throw new NotFoundException(`Product ${productId} not found`);
    return { productId: item.productId, availableStock: item.availableStock };
  }

  // Replaces the old hardcoded STOCK object — seeds once on first boot.
  private async seedStock() {
    const repo = this.dataSource.getRepository(InventoryItem);
    const count = await repo.count();
    if (count === 0) {
      await repo.save([
        { productId: 'prod-1', availableStock: 50 },
        { productId: 'prod-2', availableStock: 30 },
      ]);
      console.log('[inventory-service] seeded initial stock');
    }
  }
}