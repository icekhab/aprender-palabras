-- AlterTable
ALTER TABLE "User" ADD COLUMN "enabledExerciseTypes" INTEGER[] NOT NULL DEFAULT ARRAY[1, 3, 4, 5]::INTEGER[];
