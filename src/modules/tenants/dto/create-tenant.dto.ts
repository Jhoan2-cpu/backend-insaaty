import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PlanType } from '@prisma/client';

export class CreateTenantDto {
    @IsString()
    @IsNotEmpty({ message: 'El nombre del tenant es requerido' })
    name: string;

    @IsOptional()
    @IsEnum(PlanType, { message: 'El plan debe ser FREE, BASIC o PREMIUM' })
    plan_type?: PlanType;
}
