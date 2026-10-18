CREATE TYPE "WordGender" AS ENUM ('masculine', 'feminine');

CREATE TYPE "ImageProvider" AS ENUM ('unsplash');

CREATE TABLE "Word" (
    "id" UUID NOT NULL,
    "spanish" TEXT NOT NULL,
    "russian" TEXT NOT NULL,
    "normalizedSpanish" TEXT NOT NULL,
    "normalizedRussian" TEXT NOT NULL,
    "additionalTranslations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "definitionEs" TEXT,
    "examples" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "partOfSpeech" TEXT,
    "gender" "WordGender",
    "wrongRussian" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "wrongSpanish" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "imageUrl" TEXT,
    "imagePhotographerName" TEXT,
    "imagePhotographerUrl" TEXT,
    "imagePageUrl" TEXT,
    "imageProvider" "ImageProvider",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Word_normalizedSpanish_normalizedRussian_key"
ON "Word"("normalizedSpanish", "normalizedRussian");
