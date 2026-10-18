CREATE TYPE "UserCardSource" AS ENUM ('manual', 'lesson');

CREATE TABLE "UserCard" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "wordId" UUID NOT NULL,
    "source" "UserCardSource" NOT NULL,
    "inDictionary" BOOLEAN NOT NULL DEFAULT true,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCard_userId_wordId_key" ON "UserCard"("userId", "wordId");
CREATE INDEX "UserCard_userId_idx" ON "UserCard"("userId");
CREATE INDEX "UserCard_wordId_idx" ON "UserCard"("wordId");

ALTER TABLE "UserCard"
ADD CONSTRAINT "UserCard_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserCard"
ADD CONSTRAINT "UserCard_wordId_fkey"
FOREIGN KEY ("wordId") REFERENCES "Word"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
