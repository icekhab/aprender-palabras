# aprender-palabras

Mobile-first приложение для изучения испанских слов с уроками, ежедневными подборками и тренажёрами.

## Текущий каркас

- `apps/web` — React PWA на Vite, доступна по адресу `http://localhost:5173`;
- `apps/api` — NestJS API, доступно по адресу `http://localhost:3000`;
- `packages/contracts` — общие TypeScript-контракты frontend и backend.

Главная страница получает `Hello world` из `GET /api/hello`.

## Локальный запуск

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
```

## Документация

- [Продуктовые требования](./docs/product/README.md)
- [Общая техническая документация](./docs/technical/README.md)
