-- CreateTable
CREATE TABLE "WordAudio" (
    "wordId" UUID NOT NULL,
    "mp3" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WordAudio_pkey" PRIMARY KEY ("wordId")
);

-- AddForeignKey
ALTER TABLE "WordAudio" ADD CONSTRAINT "WordAudio_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;
