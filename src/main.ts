import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
  });

  // Habilitar validación global con class-validator
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,           // Elimina propiedades no definidas en el DTO
    forbidNonWhitelisted: true, // Lanza error si hay propiedades extras
    transform: true,           // Transforma tipos automáticamente
  }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

