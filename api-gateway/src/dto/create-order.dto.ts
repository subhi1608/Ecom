import { IsString, IsInt, Min, IsNotEmpty } from 'class-validator';

// customerEmail removed — derived from the JWT in order-service. With
// `forbidNonWhitelisted` on, a client still sending it gets a 400.
export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
