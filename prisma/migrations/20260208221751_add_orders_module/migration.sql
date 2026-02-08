/*
  Warnings:

  - The values [ENTERPRISE] on the enum `PlanType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `customer_name` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `users` table. All the data in the column will be lost.
  - Added the required column `user_id` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `name` on the `roles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `full_name` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password_hash` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PlanType_new" AS ENUM ('FREE', 'BASIC', 'PREMIUM');
ALTER TABLE "public"."tenants" ALTER COLUMN "plan_type" DROP DEFAULT;
ALTER TABLE "tenants" ALTER COLUMN "plan_type" TYPE "PlanType_new" USING ("plan_type"::text::"PlanType_new");
ALTER TYPE "PlanType" RENAME TO "PlanType_old";
ALTER TYPE "PlanType_new" RENAME TO "PlanType";
DROP TYPE "public"."PlanType_old";
ALTER TABLE "tenants" ALTER COLUMN "plan_type" SET DEFAULT 'FREE';
COMMIT;

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_tenant_id_fkey";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "customer_name",
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "description" TEXT,
DROP COLUMN "name",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "created_at",
DROP COLUMN "is_active",
DROP COLUMN "name",
DROP COLUMN "password",
DROP COLUMN "updated_at",
ADD COLUMN     "full_name" TEXT NOT NULL,
ADD COLUMN     "last_login" TIMESTAMP(3),
ADD COLUMN     "password_hash" TEXT NOT NULL;

-- DropEnum
DROP TYPE "UserRole";

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
