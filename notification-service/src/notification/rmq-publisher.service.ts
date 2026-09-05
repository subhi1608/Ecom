import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqplib from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

// A direct amqplib publisher for the retry/DLQ queues. We deliberately do
// NOT use @nestjs/microservices' ClientProxy.emit() here: ClientProxy always
// publishes to the queue it was registered with (events_queue), regardless
// of the pattern string passed to emit() — the pattern only affects how a
// *consumer* routes a message already sitting in whatever queue it landed
// in. To actually land a message in events_queue.retry or events_queue.dlq
// (distinct physical queues), we publish directly with amqplib, using the
// same {pattern, data} JSON shape Nest's RMQ transport expects on the wire,
// so a message correctly routes back to handlePaymentCompleted once it
// dead-letters from the retry queue back into events_queue.
@Injectable()
export class RmqPublisherService implements OnModuleInit, OnModuleDestroy {
  private connection?: amqplib.ChannelModel;
  private channel?: amqplib.Channel;

  async onModuleInit() {
    this.connection = await amqplib.connect(RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  publishToQueue(queue: string, pattern: string, data: unknown) {
    if (!this.channel) {
      throw new Error('RmqPublisherService: channel not initialized');
    }
    const packet = { pattern, data };
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(packet)), {
      persistent: true,
    });
  }
}
