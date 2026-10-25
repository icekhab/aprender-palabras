-- AlterTable
ALTER TABLE "User" ADD COLUMN "dailyGenerationLimit" INTEGER,
ADD COLUMN "dailySuggestionsLimit" INTEGER,
ADD COLUMN "quotaDate" DATE,
ADD COLUMN "generationsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "suggestionsCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Word" ADD COLUMN "imageGenerationCount" INTEGER NOT NULL DEFAULT 0;
