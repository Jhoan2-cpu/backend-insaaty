import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PlanType } from '@prisma/client';

export class UpdateTenantDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsEnum(PlanType, { message: 'El plan debe ser FREE, BASIC o PREMIUM' })
    plan_type?: PlanType;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}
