import { Injectable, Inject, OnModuleInit, NotFoundException, ConflictException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
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
    dto: { productId: string; quantity: number; customerEmail: string },
    correlationId: string,
  ) {
    const order = this.orderRepo.create({ ...dto, status: OrderStatus.PENDING });
    await this.orderRepo.save(order);

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

  async listOrders(filters: {
    status?: OrderStatus;
    customerEmail?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = Math.min(filters.limit && filters.limit > 0 ? filters.limit : 20, 100);

    const where: FindOptionsWhere<Order> = {};
    if (filters.status) where.status = filters.status;
    if (filters.customerEmail) where.customerEmail = filters.customerEmail;

    const [data, total] = await this.orderRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async getOrder(id: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async cancelOrder(id: string, correlationId: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

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
