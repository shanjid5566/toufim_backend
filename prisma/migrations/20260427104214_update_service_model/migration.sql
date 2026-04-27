/*
  Warnings:

  - You are about to drop the column `images` on the `Service` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Service` table. All the data in the column will be lost.
  - Added the required column `name` to the `Service` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `category` on the `Service` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('PLUMBING_SERVICES', 'ROOFING_SERVICES', 'PLASTERING_SERVICE', 'ELECTRICAL_SERVICES', 'TILING_SERVICES', 'COMPLETE_FLOORING_SOLUTIONS', 'CLEANING_SERVICES', 'OVERALL_SERVICE');

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "images",
DROP COLUMN "title",
ADD COLUMN     "bannerImage" TEXT,
ADD COLUMN     "galleryImages" TEXT[],
ADD COLUMN     "name" TEXT NOT NULL,
DROP COLUMN "category",
ADD COLUMN     "category" "ServiceCategory" NOT NULL;
