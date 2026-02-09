import {
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateTransactionDto {
    @IsInt({ message: 'El product_id debe ser un número entero' })
    product_id: number;

    @IsEnum(TransactionType, { message: 'El tipo debe ser IN, OUT o ADJUSTMENT' })
    @IsNotEmpty({ message: 'El tipo de transacción es requerido' })
    type: TransactionType;

    @IsInt({ message: 'La cantidad debe ser un número entero' })
    @Min(1, { message: 'La cantidad debe ser al menos 1' })
    quantity: number;

    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsInt({ message: 'El supplier_id debe ser un número entero' })
    supplier_id?: number;
}
