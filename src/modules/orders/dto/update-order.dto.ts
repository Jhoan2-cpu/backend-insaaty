import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateOrderDto {
    @IsEnum(OrderStatus)
    @IsOptional()
    status?: OrderStatus;

    @IsString()
    @IsOptional()
    notes?: string;
}
