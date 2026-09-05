import { NestFactory } from '@nestjs/core';
import { Transport, RmqOptions } from '@nestjs/microservices';
import * as amqplib from 'amqplib';
import { AppModule } from './app.module';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE = 'events_queue';
const DLQ = `${QUEUE}.dlq`;
const RETRY_QUEUE = `${QUEUE}.retry`;
const RETRY_DELAY_MS = 5000;

async function setupQueueTopology() {
  const conn = await amqplib.connect(RABBITMQ_URL);
  const channel = await conn.createChannel();
  await channel.assertQueue(DLQ, { durable: true });
  // Messages sit here for RETRY_DELAY_MS, then dead-letter back into the
  // main queue for redelivery — the classic RabbitMQ delayed-retry pattern.
  await channel.assertQueue(RETRY_QUEUE, {
    durable: true,
    arguments: {
      'x-message-ttl': RETRY_DELAY_MS,
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': QUEUE,
    },
  });
  await channel.close();
  await conn.close();
}

async function bootstrap() {
  await setupQueueTopology();

  const app = await NestFactory.create(AppModule);

  // Drain in-flight RMQ handlers and close the connection cleanly on
  // SIGTERM/SIGINT instead of dropping a notification mid-flight.
  app.enableShutdownHooks();

  app.connectMicroservice<RmqOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [RABBITMQ_URL],
      queue: QUEUE,
      queueOptions: {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': DLQ,
        },
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT || 3004);
  console.log(
    `notification-service listening on port ${process.env.PORT || 3004} (HTTP) and for events (RMQ)`,
  );
}
bootstrap();
