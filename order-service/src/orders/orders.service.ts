import { Injectable, Inject, OnModuleInit, NotFoundException, ConflictException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, QueryFailedError, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
  ) {}

  async onModuleInit() {
    await this.client.connect();
  }

  async createOrder(
    dto: { productId: string; quantity: number },
    correlationId: string,
    customerEmail: string,
    idempotencyKey?: string,
  ) {
    // A client-supplied Idempotency-Key lets a retried/double-clicked submit
    // return the order that was already created instead of placing a second
    // one. No key at all (older/other callers) skips the lookup entirely.
    if (idempotencyKey) {
      const existing = await this.orderRepo.findOne({ where: { idempotencyKey } });
      if (existing) return existing;
    }

    const order = this.orderRepo.create({
      ...dto,
      // Identity comes from the verified token, never from the request body.
      customerEmail,
      status: OrderStatus.PENDING,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });

    try {
      await this.orderRepo.save(order);
    } catch (err) {
      // The findOne check above and this save aren't atomic, so two
      // concurrent requests with the same key can both pass the check and
      // race to insert. The loser hits the DB's unique constraint on
      // idempotencyKey (Postgres 23505) — recover by returning the row the
      // winner actually inserted instead of surfacing the DB error. Same
      // check TypeORM error shape as payment-service's idempotency guard.
      if (
        idempotencyKey &&
        err instanceof QueryFailedError &&
        (err as unknown as { code?: string }).code === '23505'
      ) {
        const winner = await this.orderRepo.findOne({ where: { idempotencyKey } });
        if (winner) return winner;
      }
      throw err;
    }

    this.client.emit('order_created', {
      correlationId,
      data: {
        orderId: order.id,
        productId: order.productId,
        quantity: order.quantity,
        customerEmail: order.customerEmail,
      },
    });

    console.log(`[order-service] [${correlationId}] order ${order.id} created, event published`);
    return order;
  }

  async listOrders(
    filters: {
      status?: OrderStatus;
      page?: number;
      limit?: number;
    },
    customerEmail: string,
  ) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = Math.min(filters.limit && filters.limit > 0 ? filters.limit : 20, 100);

    // customerEmail is set from the token and deliberately not taken from
    // `filters` — a query param must not be able to widen this.
    const where: FindOptionsWhere<Order> = { customerEmail };
    if (filters.status) where.status = filters.status;

    const [data, total] = await this.orderRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async getOrder(id: string, customerEmail: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    // 404 rather than 403 for someone else's order: a 403 confirms the
    // order exists, which is itself an information leak.
    if (!order || order.customerEmail !== customerEmail) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  async cancelOrder(id: string, correlationId: string, customerEmail: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order || order.customerEmail !== customerEmail) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException(
        `Order ${id} cannot be cancelled (status: ${order.status})`,
      );
    }

    await this.orderRepo.update(id, { status: OrderStatus.CANCELLED });

    this.client.emit('order_cancelled', {
      correlationId,
      data: { orderId: order.id, productId: order.productId, quantity: order.quantity },
    });

    console.log(`[order-service] [${correlationId}] order ${id} CANCELLED`);
    return { ...order, status: OrderStatus.CANCELLED };
  }

  async markFulfilled(orderId: string, correlationId: string) {
    await this.orderRepo.update(orderId, { status: OrderStatus.FULFILLED });
    console.log(`[order-service] [${correlationId}] order ${orderId} FULFILLED`);
  }

  async markFailed(orderId: string, reason: string, correlationId: string) {
    await this.orderRepo.update(orderId, { status: OrderStatus.FAILED, failureReason: reason });
    console.log(`[order-service] [${correlationId}] order ${orderId} FAILED: ${reason}`);
  }
}
