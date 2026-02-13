import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export enum StockStatus {
    ALL = 'all',
    LOW_STOCK = 'low_stock',
    OUT_OF_STOCK = 'out_of_stock',
    IN_STOCK = 'in_stock',
}

export class FilterProductsDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(StockStatus)
    stockStatus?: StockStatus;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    limit?: number = 10;
}
