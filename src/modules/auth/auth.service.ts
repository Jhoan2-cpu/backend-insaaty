import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(private usersService: UsersService, private jwtService: JwtService) {}

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.usersService.findOneByEmail(email);

        if (user && user.password_hash && (await bcrypt.compare(pass, user.password_hash))) {
            const { password_hash, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any) {
        // Payload del token con tus campos
        const payload = {
            email: user.email,
            sub: user.id,       // Tu ID es un Int, está bien
            tenantId: user.tenant_id,
            roleId: user.role_id
        };

        return {
            access_token: this.jwtService.sign(payload),
        };
    }

    async findAll() {
        // lógica para obtener todos los usuarios
    }

    async findOne(id: number) {
        // lógica para obtener un usuario por id
    }

    async update(id: number, updateUserDto: UpdateUserDto) {
        // lógica para actualizar un usuario
    }

    async remove(id: number) {
        // lógica para eliminar un usuario
    }
}