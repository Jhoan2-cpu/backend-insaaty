import { PlanType, PrismaClient, Tenant, User } from '@prisma/client';
const prisma = new PrismaClient();

const passwordHash = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8m5r6h6bZ8b6Z8b6Z8b6Z8b6Z8b6Z8b6'; // "password" hashed

async function main() {
  // Crear 3 tenants
  const tenantsData = [
    { name: 'Tenant 1', plan_type: PlanType.FREE, is_active: true },
    { name: 'Tenant 2', plan_type: PlanType.BASIC, is_active: true },
    { name: 'Tenant 3', plan_type: PlanType.PREMIUM, is_active: true },
  ];

  const tenants: Tenant[] = [];
  for (const data of tenantsData) {
    const tenant = await prisma.tenant.upsert({
      where: { name: data.name },
      update: {},
      create: data,
    });
    tenants.push(tenant);
  }

  // Poblar productos para cada tenant (solo si no existen)
  for (const tenant of tenants) {
    const productsCount = await prisma.product.count({ where: { tenant_id: tenant.id } });
    if (productsCount === 0) {
      await prisma.product.createMany({
        data: [
          { tenant_id: tenant.id, sku: `SKU${tenant.id}01`, name: `Producto A T${tenant.id}`, price_cost: 10, price_sale: 15, min_stock: 5 },
          { tenant_id: tenant.id, sku: `SKU${tenant.id}02`, name: `Producto B T${tenant.id}`, price_cost: 20, price_sale: 30, min_stock: 3 }
        ],
        skipDuplicates: true,
      });
    }
  }

  // Roles
  await prisma.role.createMany({
    data: [
      { name: 'ADMIN', description: 'Administrator role' },
      { name: 'MANAGER', description: 'Manager role' },
      { name: 'EMPLOYEE', description: 'Employee role' },
    ],
    skipDuplicates: true,
  });

  // Obtener los IDs de los roles por nombre
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const managerRole = await prisma.role.findUnique({ where: { name: 'MANAGER' } });
  const employeeRole = await prisma.role.findUnique({ where: { name: 'EMPLOYEE' } });

  // Usuarios: 20 usuarios distribuidos entre los 3 tenants y roles
  const usersData: Omit<User, 'id' | 'last_login' | 'bio' | 'avatar_url'>[] = [];
  for (let i = 1; i <= 20; i++) {
    const tenant = tenants[(i - 1) % tenants.length];
    // Alterna entre los roles
    let role_id = adminRole?.id;
    if (i % 3 === 2) role_id = managerRole?.id;
    if (i % 3 === 0) role_id = employeeRole?.id;
    usersData.push({
      email: `user${i}@tenant${tenant.id}.com`,
      password_hash: passwordHash,
      full_name: `User ${i} Tenant ${tenant.id}`,
      tenant_id: tenant.id,
      role_id: role_id!,
    });
  }

  await prisma.user.createMany({
    data: usersData,
    skipDuplicates: true,
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());