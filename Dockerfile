# Etapa 1: Construcción
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Generar cliente de Prisma y compilar NestJS
RUN npx prisma generate
RUN npm run build

# Etapa 2: Ejecución
FROM node:20-alpine

WORKDIR /app

# Copiar solo lo necesario desde la etapa de construcción
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Exponer el puerto del backend
EXPOSE 3000

# Comando para iniciar la aplicación (corriendo migraciones antes si es necesario)
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
