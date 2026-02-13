-- AlterTable (Users)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;

-- AlterTable (Inventory Transactions)
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "supplier_id" INTEGER;

-- AlterTable (Orders)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_name" TEXT;

-- CreateEnum (ReportType)
DO $$ BEGIN
    CREATE TYPE "ReportType" AS ENUM ('SALES', 'INVENTORY', 'MOVEMENTS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable (Reports)
CREATE TABLE IF NOT EXISTS "reports" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "ReportType" NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (Reports)
DO $$ BEGIN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateIndex (Reports)
CREATE INDEX IF NOT EXISTS "reports_tenant_id_idx" ON "reports"("tenant_id");
CREATE INDEX IF NOT EXISTS "reports_user_id_idx" ON "reports"("user_id");
