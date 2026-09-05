import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { RmqPublisherService } from './rmq-publisher.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, RmqPublisherService],
})
export class NotificationModule {}
