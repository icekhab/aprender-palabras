-- AlterTable
ALTER TABLE "User" ADD COLUMN "currentLessonId" UUID;

-- CreateTable
CREATE TABLE "Lesson" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonWord" (
    "id" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "wordId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_userId_position_key" ON "Lesson"("userId", "position");

-- CreateIndex
CREATE INDEX "Lesson_userId_idx" ON "Lesson"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonWord_lessonId_wordId_key" ON "LessonWord"("lessonId", "wordId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonWord_lessonId_position_key" ON "LessonWord"("lessonId", "position");

-- CreateIndex
CREATE INDEX "LessonWord_wordId_idx" ON "LessonWord"("wordId");

-- AddForeignKey
ALTER TABLE "Lesson"
ADD CONSTRAINT "Lesson_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User"
ADD CONSTRAINT "User_currentLessonId_fkey"
FOREIGN KEY ("currentLessonId") REFERENCES "Lesson"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonWord"
ADD CONSTRAINT "LessonWord_lessonId_fkey"
FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonWord"
ADD CONSTRAINT "LessonWord_wordId_fkey"
FOREIGN KEY ("wordId") REFERENCES "Word"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
