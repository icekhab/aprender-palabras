-- Local-dev seed users (same password as admin: 123345)
INSERT INTO "User" (
    "id",
    "login",
    "normalizedLogin",
    "passwordHash",
    "role"
)
VALUES
    (
        '0199f98d-83c0-7bde-a537-b74cf7e9ea35',
        'teacher@local.test',
        'teacher@local.test',
        '$argon2id$v=19$m=65536,p=4,t=3$wTLVO0Cauibw5R0IToCucA$yHJsCfkeaFsmmTing4GbW+UhACxdLSYFcuw4gmaV+Kw',
        'teacher'
    ),
    (
        '0199f98d-83c0-7bde-a537-b74cf7e9ea36',
        'user@local.test',
        'user@local.test',
        '$argon2id$v=19$m=65536,p=4,t=3$wTLVO0Cauibw5R0IToCucA$yHJsCfkeaFsmmTing4GbW+UhACxdLSYFcuw4gmaV+Kw',
        'user'
    )
ON CONFLICT ("normalizedLogin") DO NOTHING;
