import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

//Este servicio se encarga de gestionar la conexión con la base de datos utilizando Prisma.

@Injectable() //Convertimos la clase en un proveedor inyectable de NestJS
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect(); //Conecta a la base de datos al iniciar el módulo, el módulo es AppModule, que importa PrismaService.
  }
}