import { IsString, IsInt, Min, IsNotEmpty } from 'class-validator';

// customerEmail is deliberately absent — it is derived from the verified
// JWT, never accepted from the request body. `forbidNonWhitelisted` is on,
// so a client still sending it now gets a 400.
export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
