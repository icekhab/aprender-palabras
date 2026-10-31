-- No production lesson data: wipe any local Lesson rows before schema change.
DELETE FROM "LessonWord";
DELETE FROM "Lesson";

-- Drop User.currentLessonId
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_currentLessonId_fkey";
DROP INDEX IF EXISTS "User_currentLessonId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "currentLessonId";

-- Drop Lesson.userId
ALTER TABLE "Lesson" DROP CONSTRAINT IF EXISTS "Lesson_userId_fkey";
DROP INDEX IF EXISTS "Lesson_userId_position_key";
DROP INDEX IF EXISTS "Lesson_userId_idx";
ALTER TABLE "Lesson" DROP COLUMN "userId";

-- CreateEnum
CREATE TYPE "CourseMembershipStatus" AS ENUM ('pending', 'accepted', 'completed');

-- CreateTable
CREATE TABLE "Course" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseMembership" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "CourseMembershipStatus" NOT NULL,
    "currentLessonId" UUID,
    "invitedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "CourseMembership_pkey" PRIMARY KEY ("id")
);

-- AlterTable Lesson: add courseId
ALTER TABLE "Lesson" ADD COLUMN "courseId" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "Course_createdByUserId_idx" ON "Course"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseMembership_courseId_userId_key" ON "CourseMembership"("courseId", "userId");

-- CreateIndex
CREATE INDEX "CourseMembership_userId_idx" ON "CourseMembership"("userId");

-- CreateIndex
CREATE INDEX "CourseMembership_courseId_idx" ON "CourseMembership"("courseId");

-- CreateIndex
CREATE INDEX "CourseMembership_currentLessonId_idx" ON "CourseMembership"("currentLessonId");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_courseId_position_key" ON "Lesson"("courseId", "position");

-- CreateIndex
CREATE INDEX "Lesson_courseId_idx" ON "Lesson"("courseId");

-- AddForeignKey
ALTER TABLE "Course"
ADD CONSTRAINT "Course_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMembership"
ADD CONSTRAINT "CourseMembership_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMembership"
ADD CONSTRAINT "CourseMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMembership"
ADD CONSTRAINT "CourseMembership_currentLessonId_fkey"
FOREIGN KEY ("currentLessonId") REFERENCES "Lesson"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson"
ADD CONSTRAINT "Lesson_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
