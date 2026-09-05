import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [HttpModule],
  controllers: [InventoryController],
})
export class InventoryModule {}
