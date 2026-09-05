import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Transport, RmqOptions } from '@nestjs/microservices';
import * as amqplib from 'amqplib';
import { AppModule } from './app.module';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE = 'order_service_queue';
const DLQ = `${QUEUE}.dlq`;

async function setupDeadLetterQueue() {
  const conn = await amqplib.connect(RABBITMQ_URL);
  const channel = await conn.createChannel();
  await channel.assertQueue(DLQ, { durable: true });
  await channel.close();
  await conn.close();
}

async function bootstrap() {
  await setupDeadLetterQueue();

  const app = await NestFactory.create(AppModule);

  // Drain in-flight HTTP requests and RMQ handlers (and close the RMQ
  // connection cleanly) on SIGTERM/SIGINT instead of dropping messages.
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

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
  await app.listen(process.env.PORT || 3001);
  console.log(`order-service listening on port ${process.env.PORT || 3001}`);
}
bootstrap();
