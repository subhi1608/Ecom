import { Module } from '@nestjs/common';
import { InventoryModule } from './inventory/inventory.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem, Reservation } from './inventory/entities/inventory.entity';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [InventoryItem, Reservation],
      synchronize: true, // OK for now — replace with migrations before real prod use
    }),
    InventoryModule,
    HealthModule,
  ],
})
export class AppModule {}
