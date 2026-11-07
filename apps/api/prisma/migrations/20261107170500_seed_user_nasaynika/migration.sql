-- Production user account (same password as admin: 123345)
INSERT INTO "User" (
    "id",
    "login",
    "normalizedLogin",
    "passwordHash",
    "role"
)
VALUES (
    '8ad49db3-cfc3-471b-9e7b-58d88573cf72',
    'nasaynika@gmail.com',
    'nasaynika@gmail.com',
    '$argon2id$v=19$m=65536,p=4,t=3$wTLVO0Cauibw5R0IToCucA$yHJsCfkeaFsmmTing4GbW+UhACxdLSYFcuw4gmaV+Kw',
    'user'
)
ON CONFLICT ("normalizedLogin") DO NOTHING;
