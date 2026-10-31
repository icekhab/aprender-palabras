-- Production user account (same password as admin: 123345)
INSERT INTO "User" (
    "id",
    "login",
    "normalizedLogin",
    "passwordHash",
    "role"
)
VALUES (
    '4d0ba2b0-0733-4d01-9807-651b26270286',
    'yaroslav.x2@gmail.com',
    'yaroslav.x2@gmail.com',
    '$argon2id$v=19$m=65536,p=4,t=3$wTLVO0Cauibw5R0IToCucA$yHJsCfkeaFsmmTing4GbW+UhACxdLSYFcuw4gmaV+Kw',
    'user'
)
ON CONFLICT ("normalizedLogin") DO NOTHING;
