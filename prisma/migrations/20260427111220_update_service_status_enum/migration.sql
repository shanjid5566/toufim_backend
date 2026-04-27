/*
  Warnings:

  - The values [LIVE,MAINTENANCE] on the enum `ServiceStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ServiceStatus_new" AS ENUM ('ACTIVE', 'COMPLETED', 'DRAFT');
ALTER TABLE "public"."Service" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Service" ALTER COLUMN "status" TYPE "ServiceStatus_new" USING ("status"::text::"ServiceStatus_new");
ALTER TYPE "ServiceStatus" RENAME TO "ServiceStatus_old";
ALTER TYPE "ServiceStatus_new" RENAME TO "ServiceStatus";
DROP TYPE "public"."ServiceStatus_old";
ALTER TABLE "Service" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
