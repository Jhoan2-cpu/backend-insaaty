import {
    IsDecimal,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto {
    @IsString()
    @IsNotEmpty({ message: 'El SKU es requerido' })
    sku: string;

    @IsString()
    @IsNotEmpty({ message: 'El nombre es requerido' })
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @Transform(({ value }) => parseFloat(value))
    @IsNumber({}, { message: 'El precio de costo debe ser un número' })
    @Min(0, { message: 'El precio de costo no puede ser negativo' })
    price_cost: number;

    @Transform(({ value }) => parseFloat(value))
    @IsNumber({}, { message: 'El precio de venta debe ser un número' })
    @Min(0, { message: 'El precio de venta no puede ser negativo' })
    price_sale: number;

    @IsOptional()
    @IsInt({ message: 'El stock mínimo debe ser un número entero' })
    @Min(0, { message: 'El stock mínimo no puede ser negativo' })
    min_stock?: number;

    @IsOptional()
    @IsInt({ message: 'El stock actual debe ser un número entero' })
    @Min(0, { message: 'El stock actual no puede ser negativo' })
    current_stock?: number;
}
