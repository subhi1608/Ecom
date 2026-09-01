// payment-service/src/payment/entities/payment.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum PaymentStatus {
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The unique constraint is what enforces idempotency at the DB level.
  @Column({ unique: true })
  orderId: string;

  @Column({ type: 'enum', enum: PaymentStatus })
  status: PaymentStatus;

  @CreateDateColumn()
  processedAt: Date;
}