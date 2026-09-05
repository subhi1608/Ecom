import { Controller, Get, Param } from '@nestjs/common';
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
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.inventoryService.reserveStock(message.data, message.correlationId);
      // Manual ack — since this event triggers a real side effect (stock
      // reservation), we only ack after the reservation attempt completes.
      channel.ack(originalMsg);
    } catch (err) {
      // Anything reserveStock's own logic doesn't already handle (e.g. a DB
      // connection drop mid-transaction) lands here. Nack without requeue so
      // it dead-letters to events_queue.dlq for manual inspection instead of
      // looping forever or being silently acked away.
      console.error(
        `[inventory-service] [${message.correlationId}] unexpected error reserving stock for order ${message.data.orderId}, nacking to DLQ`,
        err,
      );
      channel.nack(originalMsg, false, false);
    }
  }

  @EventPattern('payment_failed')
  async handlePaymentFailed(
    @Payload() message: { correlationId: string; data: { orderId: string } },
  ) {
    // Compensating transaction: payment failed downstream, release the
    // stock we reserved earlier for this order.
    await this.inventoryService.releaseStock(message.data.orderId, message.correlationId);
  }

  @EventPattern('order_cancelled')
  async handleOrderCancelled(
    @Payload() message: { correlationId: string; data: { orderId: string } },
  ) {
    // Same compensating-transaction path as payment_failed — a cancelled
    // order releases whatever stock it had reserved.
    await this.inventoryService.releaseStock(message.data.orderId, message.correlationId);
  }

  @Get(':productId')
  async getStock(@Param('productId') productId: string) {
    return this.inventoryService.getStock(productId);
  }
}
