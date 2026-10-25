-- Low daily overrides for local seed users (manual quota testing).
UPDATE "User"
SET
  "dailyGenerationLimit" = 2,
  "dailySuggestionsLimit" = 10
WHERE "normalizedLogin" IN ('user@local.test', 'teacher@local.test');
