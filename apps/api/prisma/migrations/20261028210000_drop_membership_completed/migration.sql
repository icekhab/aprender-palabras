-- Convert completed memberships back to accepted, then drop completed.
UPDATE "CourseMembership"
SET status = 'accepted', "completedAt" = NULL
WHERE status = 'completed';

ALTER TABLE "CourseMembership" DROP COLUMN "completedAt";

CREATE TYPE "CourseMembershipStatus_new" AS ENUM ('pending', 'accepted');

ALTER TABLE "CourseMembership"
  ALTER COLUMN "status" TYPE "CourseMembershipStatus_new"
  USING ("status"::text::"CourseMembershipStatus_new");

DROP TYPE "CourseMembershipStatus";

ALTER TYPE "CourseMembershipStatus_new" RENAME TO "CourseMembershipStatus";
