/*
  Warnings:

  - Added the required column `basePrice` to the `TicketPackage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TicketPackage" ADD COLUMN     "basePrice" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "savePercentage" DECIMAL(5,2) NOT NULL DEFAULT 0;
