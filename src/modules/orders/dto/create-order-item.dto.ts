import { IsInt, Min } from 'class-validator';

export class CreateOrderItemDto {
    @IsInt()
    product_id: number;

    @IsInt()
    @Min(1)
    quantity: number;
}
