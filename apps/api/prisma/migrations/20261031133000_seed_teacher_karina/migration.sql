-- Production teacher account (same password as admin: 123345)
INSERT INTO "User" (
    "id",
    "login",
    "normalizedLogin",
    "passwordHash",
    "role"
)
VALUES (
    '1f42a144-91fa-4909-bcca-a59fe2df71d0',
    'karina',
    'karina',
    '$argon2id$v=19$m=65536,p=4,t=3$wTLVO0Cauibw5R0IToCucA$yHJsCfkeaFsmmTing4GbW+UhACxdLSYFcuw4gmaV+Kw',
    'teacher'
)
ON CONFLICT ("normalizedLogin") DO NOTHING;
