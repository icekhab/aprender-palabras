-- AlterTable
ALTER TABLE "UserCard" ADD COLUMN "lastTrainedAt" TIMESTAMPTZ(3);
ALTER TABLE "UserCard" ADD COLUMN "completedTrainerCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserCard" ADD COLUMN "showCount" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "DailyTrainerKind" AS ENUM ('daily', 'extra');

-- CreateEnum
CREATE TYPE "DailyTrainerStatus" AS ENUM ('not_started', 'completed');

-- CreateTable
CREATE TABLE "DailyTrainingDay" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyTrainingDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTrainer" (
    "id" UUID NOT NULL,
    "dayId" UUID NOT NULL,
    "kind" "DailyTrainerKind" NOT NULL,
    "slot" INTEGER NOT NULL,
    "status" "DailyTrainerStatus" NOT NULL DEFAULT 'not_started',
    "sourceLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyTrainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTrainerWord" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "userCardId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "DailyTrainerWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyTrainingDay_userId_date_key" ON "DailyTrainingDay"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyTrainingDay_userId_idx" ON "DailyTrainingDay"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTrainer_dayId_kind_slot_key" ON "DailyTrainer"("dayId", "kind", "slot");

-- CreateIndex
CREATE INDEX "DailyTrainer_dayId_idx" ON "DailyTrainer"("dayId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTrainerWord_trainerId_position_key" ON "DailyTrainerWord"("trainerId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTrainerWord_trainerId_userCardId_key" ON "DailyTrainerWord"("trainerId", "userCardId");

-- CreateIndex
CREATE INDEX "DailyTrainerWord_userCardId_idx" ON "DailyTrainerWord"("userCardId");

-- AddForeignKey
ALTER TABLE "DailyTrainingDay"
ADD CONSTRAINT "DailyTrainingDay_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTrainer"
ADD CONSTRAINT "DailyTrainer_dayId_fkey"
FOREIGN KEY ("dayId") REFERENCES "DailyTrainingDay"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTrainerWord"
ADD CONSTRAINT "DailyTrainerWord_trainerId_fkey"
FOREIGN KEY ("trainerId") REFERENCES "DailyTrainer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTrainerWord"
ADD CONSTRAINT "DailyTrainerWord_userCardId_fkey"
FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
