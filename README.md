# aprender-palabras

Mobile-first приложение для изучения испанских слов с уроками, ежедневными подборками и тренажёрами.

## Текущий каркас

- `apps/web` — React PWA на Vite, доступна по адресу `http://localhost:5173`;
- `apps/api` — NestJS API, доступно по адресу `http://localhost:3000`;
- `packages/contracts` — общие TypeScript-контракты frontend и backend.

Главная страница показывает поиск слов; подсказки перевода приходят из
`GET /api/suggestions` через OpenAI.

## Запуск в Docker

Установите или обновите [Docker Desktop](https://www.docker.com/products/docker-desktop/)
и убедитесь, что он запущен.

Frontend, backend и PostgreSQL запускаются одной командой:

```bash
pnpm start
```

После запуска доступны:

- frontend — `http://localhost:5173`;
- backend — `http://localhost:3000/api/health`;
- PostgreSQL — `localhost:5432`.

Исходники подключены к контейнерам, поэтому Vite и NestJS автоматически
перезапускаются при изменениях. Данные PostgreSQL сохраняются в Docker volume.

Остановить сервисы:

```bash
pnpm stop
```

Удалить сервисы вместе с локальными данными PostgreSQL:

```bash
docker compose down --volumes
```

Настройки по умолчанию находятся в `.env.example`. Чтобы изменить их локально,
скопируйте файл в `.env`; этот файл не попадёт в Git.

## Запуск без Docker

Одноразовая настройка на macOS:

```bash
brew install fnm
echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc
exec zsh
fnm use --install-if-missing
npm install --global pnpm@12.14.0
```

Запуск проекта:

```bash
fnm use --install-if-missing
pnpm install
pnpm dev
```

Проверки проекта:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:migrate
```

## Production (VPS)

Один VPS: PostgreSQL + NestJS API + статичный frontend за Caddy с HTTPS
([`compose.prod.yaml`](./compose.prod.yaml)).

Нужны: VPS с Docker, домен (A-запись на IP сервера), ключи OpenAI/Unsplash.

### 1. Сервер

1. Арендуйте VPS (например Hetzner CX22 / аналог ~€4–6/мес), Ubuntu 24.04.
2. Откройте порты **80** и **443** в firewall.
3. Установите Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# перелогиньтесь, затем:
docker compose version
```

4. Клонируйте репозиторий:

```bash
git clone git@github.com:icekhab/aprender-palabras.git
cd aprender-palabras
```

### 2. DNS

В DNS домена создайте **A**-запись на IP VPS, например:

- `palabras.example.com` → `YOUR.VPS.IP`

Дождитесь распространения DNS (минуты–часы).

### 3. Env и запуск

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Заполните `APP_DOMAIN`, `ACME_EMAIL`, `APP_ORIGIN` (`https://` + тот же домен),
сильный `POSTGRES_PASSWORD` (тот же пароль в `DATABASE_URL`), ключи API.

```bash
docker compose --env-file .env.prod -f compose.prod.yaml up -d --build
```

Проверки:

- `https://APP_DOMAIN` — приложение;
- `https://APP_DOMAIN/api/health` — health API.

При старте API выполняет `prisma migrate deploy`. Тестовый пользователь —
см. [auth](./docs/technical/auth.md).

Обновление после `git pull`:

```bash
docker compose --env-file .env.prod -f compose.prod.yaml up -d --build
```

### Альтернатива: всё на Railway

Один проект: **PostgreSQL** + **api** ([`Dockerfile`](./Dockerfile)) + **web**
([`Dockerfile.web`](./Dockerfile.web) — статика и proxy `/api` → api).

1. Запушьте `main` на GitHub (нужны Docker-файлы в репо).
2. **Postgres** — Add → Database → PostgreSQL.
3. Сервис **api** (можно переименовать в `api`):
   - Builder: Dockerfile, path `Dockerfile`
   - Variables: `DATABASE_URL` (reference из Postgres), `NODE_ENV=production`,
     `PORT=3000`, `APP_ORIGIN` (позже = публичный URL web), ключи OpenAI/Unsplash
   - Публичный домен **не** нужен (достаточно private network)
4. Сервис **web** (переименовать в `web`):
   - Builder: Dockerfile, path `Dockerfile.web`
   - Variable: `API_UPSTREAM=http://api.railway.internal:3000`
     (имя `api` = имя сервиса API в Railway)
   - **Generate Domain** — это единственный публичный HTTPS URL
5. У api выставьте `APP_ORIGIN=https://<web-domain>` и redeploy.
6. Проверка: `https://<web-domain>/api/health` и вход в приложение.

### Альтернатива: Vercel + PaaS

[`vercel.json`](./vercel.json) — если фронт отдельно на Vercel, а API на Railway/Render.
