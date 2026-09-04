import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DataSource, QueryFailedError } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';

@Injectable()
export class PaymentService implements OnModuleInit {
  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.client.connect();
  }

  async processPayment(
    data: {
      orderId: string;
      productId: string;
      quantity: number;
      customerEmail: string;
    },
    correlationId: string,
  ) {
    // Mock gateway decision
    const success = Math.random() > 0.15;
    const status = success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

    try {
      // Atomic idempotency guard: the unique constraint on orderId means
      // a duplicate event's insert throws instead of processing again.
      await this.dataSource.getRepository(Payment).insert({
        orderId: data.orderId,
        status,
      });
    } catch (err) {
      // 23505 = Postgres unique_violation → we've already processed this order
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        console.log(
          `[payment-service] [${correlationId}] duplicate event for order ${data.orderId}, skipping`,
        );
        return;
      }
      throw err; // any other DB error → let it propagate (message will nack/retry)
    }

    // Only reached on a genuinely new order. Publish the outcome AFTER
    // the row is committed, so we never announce a payment we didn't record.
    if (status === PaymentStatus.FAILED) {
      console.log(`[payment-service] [${correlationId}] payment FAILED for order ${data.orderId}`);
      this.client.emit('payment_failed', {
        correlationId,
        data: { orderId: data.orderId, reason: 'payment_declined' },
      });
      return;
    }

    console.log(`[payment-service] [${correlationId}] payment SUCCESS for order ${data.orderId}`);
    this.client.emit('payment_completed', {
      correlationId,
      data: { orderId: data.orderId, customerEmail: data.customerEmail },
    });
  }
}
