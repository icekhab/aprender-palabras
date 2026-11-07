-- Accent-folded search keys for suggestions DB prefix match.
-- Backfill translate() mirrors JS normalizeSearchKey for common ES/RU diacritics
-- (strip accents + ё→е). New/updated rows are written from normalizeSearchKey in app code.

ALTER TABLE "Word" ADD COLUMN "searchSpanish" TEXT;
ALTER TABLE "Word" ADD COLUMN "searchRussian" TEXT;

UPDATE "Word"
SET
  "searchSpanish" = lower(
    trim(
      both FROM regexp_replace(
        translate(
          "spanish",
          'áàäâãåāăąÁÀÄÂÃÅĀĂĄéèëêěēĕėęÉÈËÊĚĒĔĖĘíìïîīĭįıÍÌÏÎĪĬĮİóòöôõøōŏőÓÒÖÔÕØŌŎŐúùüûůūŭűÚÙÜÛŮŪŬŰýÿÝŸñńņňÑŃŅŇçćĉċčÇĆĈĊČ',
          'aaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeeeiiiiiiiiiiiiiiiioooooooooooooooooouuuuuuuuuuuuuuuuyyyynnnnnnnncccccccccc'
        ),
        '\s+',
        ' ',
        'g'
      )
    )
  ),
  "searchRussian" = lower(
    trim(
      both FROM regexp_replace(
        translate(
          "russian",
          'ёЁáàäâãåāăąÁÀÄÂÃÅĀĂĄéèëêěēĕėęÉÈËÊĚĒĔĖĘíìïîīĭįıÍÌÏÎĪĬĮİóòöôõøōŏőÓÒÖÔÕØŌŎŐúùüûůūŭűÚÙÜÛŮŪŬŰýÿÝŸñńņňÑŃŅŇçćĉċčÇĆĈĊČ',
          'ееaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeeeiiiiiiiiiiiiiiiioooooooooooooooooouuuuuuuuuuuuuuuuyyyynnnnnnnncccccccccc'
        ),
        '\s+',
        ' ',
        'g'
      )
    )
  );

ALTER TABLE "Word" ALTER COLUMN "searchSpanish" SET NOT NULL;
ALTER TABLE "Word" ALTER COLUMN "searchRussian" SET NOT NULL;

CREATE INDEX "Word_searchSpanish_idx" ON "Word"("searchSpanish");
CREATE INDEX "Word_searchRussian_idx" ON "Word"("searchRussian");
