import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [NotificationModule, HealthModule],
})
export class AppModule {}
