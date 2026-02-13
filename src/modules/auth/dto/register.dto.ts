import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @IsNotEmpty({ message: 'El nombre de la empresa es requerido' })
    @IsString()
    business_name: string;

    @IsNotEmpty({ message: 'El nombre completo es requerido' })
    @IsString()
    full_name: string;

    @IsNotEmpty({ message: 'El email es requerido' })
    @IsEmail({}, { message: 'El email debe ser válido' })
    email: string;

    @IsNotEmpty({ message: 'La contraseña es requerida' })
    @IsString()
    @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    password: string;
}
