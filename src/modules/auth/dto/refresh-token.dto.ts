import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
    @IsString()
    @IsNotEmpty({ message: 'El refresh_token es requerido' })
    refresh_token: string;
}
