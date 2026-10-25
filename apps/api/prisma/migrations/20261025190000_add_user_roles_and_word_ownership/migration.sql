-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'teacher', 'admin');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'user';

-- Seed admin
UPDATE "User"
SET "role" = 'admin'
WHERE "normalizedLogin" = 'icekhab@gmail.com';

-- AlterTable
ALTER TABLE "Word" ADD COLUMN "createdByUserId" UUID,
ADD COLUMN "createdViaLesson" BOOLEAN NOT NULL DEFAULT false;

-- Backfill ownership to seed admin
UPDATE "Word"
SET "createdByUserId" = '0199f98d-83c0-7bde-a537-b74cf7e9ea34'
WHERE "createdByUserId" IS NULL;

-- AddForeignKey
ALTER TABLE "Word"
ADD CONSTRAINT "Word_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Word_createdByUserId_idx" ON "Word"("createdByUserId");

-- CreateIndex
CREATE INDEX "Word_createdAt_idx" ON "Word"("createdAt");
