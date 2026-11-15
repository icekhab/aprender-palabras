-- Drop image-per-word quota column; Unsplash search is no longer limited per Word.
ALTER TABLE "Word" DROP COLUMN "imageGenerationCount";
