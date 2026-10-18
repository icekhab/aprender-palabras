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

## Документация

- [Продуктовые требования](./docs/product/README.md)
- [Общая техническая документация](./docs/technical/README.md)
