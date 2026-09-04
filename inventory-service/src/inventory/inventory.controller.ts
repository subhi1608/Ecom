import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @EventPattern('order_created')
  async handleOrderCreated(
    @Payload()
    message: {
      correlationId: string;
      data: { orderId: string; productId: string; quantity: number; customerEmail: string };
    },
    @Ctx() context: RmqContext,
  ) {
    await this.inventoryService.reserveStock(message.data, message.correlationId);

    // Manual ack — since this event triggers a real side effect (stock
    // reservation), we only ack after the reservation attempt completes.
    // (queueOptions.noAck defaults to false in @nestjs/microservices RMQ,
    // so this is mostly illustrative here — but wire it up explicitly
    // once you add real retry/dead-letter handling.)
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }

  @EventPattern('payment_failed')
  async handlePaymentFailed(
    @Payload() message: { correlationId: string; data: { orderId: string } },
  ) {
    // Compensating transaction: payment failed downstream, release the
    // stock we reserved earlier for this order.
    await this.inventoryService.releaseStock(message.data.orderId, message.correlationId);
  }
}
