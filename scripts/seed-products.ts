import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestProducts() {
    try {
        console.log('🔍 Checking if products exist...');
        const count = await prisma.product.count();
        console.log(`Found ${count} products in database`);

        if (count > 0) {
            console.log('✅ Products already exist. No need to create test data.');
            return;
        }

        console.log('📦 Creating test products...');

        // Necesitamos un tenant_id primero. Vamos a buscar el primer usuario
        const firstUser = await prisma.user.findFirst();
        if (!firstUser) {
            console.error('❌ No users found. Please register a user first.');
            return;
        }

        const tenantId = firstUser.tenant_id;
        console.log(`Using tenant_id: ${tenantId}`);

        const testProducts = [
            {
                sku: 'PRD-001',
                name: 'Wireless Mouse',
                description: 'Ergonomic wireless mouse with USB receiver',
                price_cost: 12.00,
                price_sale: 25.99,
                min_stock: 10,
                current_stock: 3,
                tenant_id: tenantId,
            },
            {
                sku: 'PRD-002',
                name: 'Mechanical Keyboard',
                description: 'RGB mechanical gaming keyboard',
                price_cost: 45.00,
                price_sale: 89.99,
                min_stock: 20,
                current_stock: 145,
                tenant_id: tenantId,
            },
            {
                sku: 'PRD-003',
                name: 'USB-C Hub (7-in-1)',
                description: '7 port USB-C hub with HDMI, USB 3.0, SD card reader',
                price_cost: 15.50,
                price_sale: 32.00,
                min_stock: 15,
                current_stock: 0,
                tenant_id: tenantId,
            },
            {
                sku: 'PRD-004',
                name: 'LED Desk Lamp',
                description: 'Adjustable LED desk lamp with touch controls',
                price_cost: 22.00,
                price_sale: 49.99,
                min_stock: 10,
                current_stock: 8,
                tenant_id: tenantId,
            },
            {
                sku: 'PRD-005',
                name: 'Smart Watch Series 5',
                description: 'Smart watch with fitness tracking and heart rate monitor',
                price_cost: 150.00,
                price_sale: 299.99,
                min_stock: 50,
                current_stock: 320,
                tenant_id: tenantId,
            },
            {
                sku: 'PRD-006',
                name: 'Bluetooth Headphones',
                description: 'Noise-cancelling wireless headphones',
                price_cost: 80.00,
                price_sale: 159.99,
                min_stock: 30,
                current_stock: 65,
                tenant_id: tenantId,
            },
            {
                sku: 'PRD-007',
                name: 'Webcam HD 1080p',
                description: 'Full HD webcam with auto-focus',
                price_cost: 35.00,
                price_sale: 69.99,
                min_stock: 25,
                current_stock: 18,
                tenant_id: tenantId,
            },
            {
                sku: 'PRD-008',
                name: 'Phone Stand',
                description: 'Adjustable aluminum phone stand',
                price_cost: 8.00,
                price_sale: 18.99,
                min_stock: 40,
                current_stock: 0,
                tenant_id: tenantId,
            },
            {
                sku: 'PRD-009',
                name: 'External SSD 1TB',
                description: 'Portable solid state drive 1TB',
                price_cost: 90.00,
                price_sale: 179.99,
                min_stock: 20,
                current_stock: 42,
                tenant_id: tenantId,
            },
            {
                sku: 'PRD-010',
                name: 'Laptop Cooling Pad',
                description: 'Laptop cooling pad with dual fans',
                price_cost: 18.00,
                price_sale: 35.99,
                min_stock: 15,
                current_stock: 7,
                tenant_id: tenantId,
            },
            {
                sku: 'PRD-011',
                name: 'Monitor Arm Mount',
                description: 'Adjustable monitor arm for desk mounting',
                price_cost: 55.00,
                price_sale: 109.99,
                min_stock: 12,
                current_stock: 28,
                tenant_id: tenantId,
            },
            {
                sku: 'PRD-012',
                name: 'Wireless Charger',
                description: 'Fast wireless charging pad',
                price_cost: 12.00,
                price_sale: 24.99,
                min_stock: 35,
                current_stock: 0,
                tenant_id: tenantId,
            },
        ];

        for (const productData of testProducts) {
            const product = await prisma.product.create({
                data: productData,
            });
            console.log(`✅ Created: ${product.sku} - ${product.name}`);
        }

        console.log('\n🎉 Successfully created 12 test products!');
        console.log(`\nTest products summary:`);
        console.log(`- Out of Stock: 3 products (PRD-003, PRD-008, PRD-012)`);
        console.log(`- Low Stock: 3 products (PRD-001, PRD-004, PRD-010)`);
        console.log(`- In Stock: 6 products`);

    } catch (error) {
        console.error('❌ Error creating test products:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createTestProducts();
