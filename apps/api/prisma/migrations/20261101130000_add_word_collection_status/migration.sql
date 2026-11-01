-- CreateEnum
CREATE TYPE "WordCollectionStatus" AS ENUM ('created', 'ready', 'inactive');

-- AlterTable
ALTER TABLE "WordCollection" ADD COLUMN "status" "WordCollectionStatus" NOT NULL DEFAULT 'created';

-- Existing collections were already visible to users → mark ready
UPDATE "WordCollection" SET "status" = 'ready';

-- CreateIndex
CREATE INDEX "WordCollection_status_idx" ON "WordCollection"("status");
