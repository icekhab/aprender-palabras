CREATE TABLE "Test" (
    "Name" TEXT NOT NULL,
    "Size" INTEGER NOT NULL,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("Name")
);

INSERT INTO "Test" ("Name", "Size")
VALUES
    ('Alpha', 10),
    ('Beta', 20);
