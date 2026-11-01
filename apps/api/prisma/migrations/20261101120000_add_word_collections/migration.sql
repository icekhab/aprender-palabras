-- CreateEnum value for collection trainers
ALTER TYPE "DailyTrainerKind" ADD VALUE 'collection';

-- CreateTable
CREATE TABLE "WordCollection" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WordCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordCollectionItem" (
    "id" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "wordId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCollection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "addedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCollectionIntroducedWord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "wordId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCollectionIntroducedWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WordCollection_createdByUserId_idx" ON "WordCollection"("createdByUserId");

-- CreateIndex
CREATE INDEX "WordCollection_title_idx" ON "WordCollection"("title");

-- CreateIndex
CREATE INDEX "WordCollectionItem_wordId_idx" ON "WordCollectionItem"("wordId");

-- CreateIndex
CREATE UNIQUE INDEX "WordCollectionItem_collectionId_wordId_key" ON "WordCollectionItem"("collectionId", "wordId");

-- CreateIndex
CREATE UNIQUE INDEX "WordCollectionItem_collectionId_position_key" ON "WordCollectionItem"("collectionId", "position");

-- CreateIndex
CREATE INDEX "UserCollection_userId_idx" ON "UserCollection"("userId");

-- CreateIndex
CREATE INDEX "UserCollection_collectionId_idx" ON "UserCollection"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCollection_userId_collectionId_key" ON "UserCollection"("userId", "collectionId");

-- CreateIndex
CREATE INDEX "UserCollectionIntroducedWord_userId_wordId_idx" ON "UserCollectionIntroducedWord"("userId", "wordId");

-- CreateIndex
CREATE INDEX "UserCollectionIntroducedWord_collectionId_idx" ON "UserCollectionIntroducedWord"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCollectionIntroducedWord_userId_collectionId_wordId_key" ON "UserCollectionIntroducedWord"("userId", "collectionId", "wordId");

-- AddForeignKey
ALTER TABLE "WordCollection" ADD CONSTRAINT "WordCollection_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordCollectionItem" ADD CONSTRAINT "WordCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "WordCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordCollectionItem" ADD CONSTRAINT "WordCollectionItem_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollection" ADD CONSTRAINT "UserCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollection" ADD CONSTRAINT "UserCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "WordCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollectionIntroducedWord" ADD CONSTRAINT "UserCollectionIntroducedWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollectionIntroducedWord" ADD CONSTRAINT "UserCollectionIntroducedWord_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "WordCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollectionIntroducedWord" ADD CONSTRAINT "UserCollectionIntroducedWord_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;
