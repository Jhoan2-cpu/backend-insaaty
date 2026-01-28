import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Upsert para que el seed sea idempotente
  const tenant = await prisma.tenants.upsert({
    where: { name: 'Tenant 1' },
    update: {}, // No actualiza nada si ya existe
    create: {
      name: 'Tenant 1',
      plan_type: 'basic',
      is_active: true,
    },
  });

  // Poblar productos solo si el tenant es nuevo (no existía antes)
  const productsCount = await prisma.products.count({ where: { tenant_id: tenant.id } });
  if (productsCount === 0) {
    await prisma.products.createMany({
      data: [
        { tenant_id: tenant.id, sku: 'SKU001', name: 'Producto 1', price_cost: 10, price_sale: 15, min_stock: 5 },
        { tenant_id: tenant.id, sku: 'SKU002', name: 'Producto 2', price_cost: 20, price_sale: 30, min_stock: 3 }
      ],
      skipDuplicates: true,
    });
  }

  await prisma.roles.createMany({
    data: [
      { name: 'Admin', description: 'Administrator role' },
      { name: 'User', description: 'Regular user role' },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());