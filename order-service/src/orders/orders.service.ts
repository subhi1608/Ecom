import { Injectable, Inject, OnModuleInit, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async getOrder(id: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
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
