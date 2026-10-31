-- Production user account (same password as admin: 123345)
INSERT INTO "User" (
    "id",
    "login",
    "normalizedLogin",
    "passwordHash",
    "role"
)
VALUES (
    '3d68f853-2e94-4e32-ba4c-238cefd9eed2',
    'dinaghalini@gmail.com',
    'dinaghalini@gmail.com',
    '$argon2id$v=19$m=65536,p=4,t=3$wTLVO0Cauibw5R0IToCucA$yHJsCfkeaFsmmTing4GbW+UhACxdLSYFcuw4gmaV+Kw',
    'user'
)
ON CONFLICT ("normalizedLogin") DO NOTHING;
