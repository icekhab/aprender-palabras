-- Production user account (same password as admin: 123345)
INSERT INTO "User" (
    "id",
    "login",
    "normalizedLogin",
    "passwordHash",
    "role"
)
VALUES (
    '9c9332f0-5074-471a-8696-87d8f00bb97d',
    'smirnova.anim@gmail.com',
    'smirnova.anim@gmail.com',
    '$argon2id$v=19$m=65536,p=4,t=3$wTLVO0Cauibw5R0IToCucA$yHJsCfkeaFsmmTing4GbW+UhACxdLSYFcuw4gmaV+Kw',
    'user'
)
ON CONFLICT ("normalizedLogin") DO NOTHING;
