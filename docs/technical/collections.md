# Colecciones (целевая техническая спецификация)

Продуктовое поведение: [product/06-collections.md](../product/06-collections.md).
До внедрения код и схема могут не соответствовать.

## Доступ по ролям

| Действие | Кто |
|---|---|
| List / search / get / add / remove / train (`ready`) | любой auth |
| Create / rename / status / add word / remove word / delete | только `admin` (`403` иначе) |

## Модели

### `WordCollectionStatus`

`created` | `ready` | `inactive`. Default при create: `created`.

### `WordCollection`

| Поле | Описание |
|---|---|
| `id` | UUID |
| `title` | название (trim, обязателен) |
| `status` | `WordCollectionStatus` |
| `createdByUserId` | admin-создатель |
| `createdAt` / `updatedAt` | |

`ready` требует ≥1 item; нельзя remove last item while `ready`.
Переход в `inactive` → delete memberships + introduced rows; `UserCard` не трогать.
Non-admin list/get/add/train — только `ready`.

### `WordCollectionItem`

| Поле | Описание |
|---|---|
| `collectionId` + `wordId` | уникальная пара |
| `position` | порядок в наборе |

FK на существующий `Word`. Удаление `Word` при наличии item — запретить
или каскадно чистить item (продукт: не оставлять битых ссылок).

### `UserCollection`

| Поле | Описание |
|---|---|
| `userId` + `collectionId` | уникальная пара (membership) |
| `addedAt` | момент add |

Удаление `WordCollection` → cascade delete membership у всех; словари
не трогать.

### Provenance принесённых слов

Нужна связь, какие карточки пользователь получил **через** конкретную
коллекцию (для remove membership и COLL-06).

Рекомендуемая таблица `UserCollectionIntroducedWord`:

| Поле | Описание |
|---|---|
| `userId` + `collectionId` + `wordId` | уникально |
| `userCardId` | опционально, для удобства |

Правила:

- строка создаётся только когда add/auto-sync **впервые** создал
  `UserCard` (или вернул в словарь карточку, которой не было
  `inDictionary` — если такой путь появится);
- если карточка уже была в словаре — строки нет;
- при user remove: удалить из словаря карточки, у которых есть provenance
  **только** по снимаемой коллекции (нет строк других membership) и
  `completedTrainerCount = 0`; затем удалить provenance и membership;
- при admin delete collection: cascade membership + provenance rows;
  `UserCard` не удалять.

Альтернатива: JSON/флаги на `UserCard` без per-collection учёта **не
подходит** — одно слово может быть принесено несколькими коллекциями.

## Прогресс коллекции

Считается на чтении (или денормализуется позже):

```text
avg(UserCard.progress)
  where wordId IN current collection items
    AND userId = current user
    AND inDictionary = true
```

Округление до int для API/UI.

## REST API (эскиз)

Префикс `/api`. Сессия обязательна.

| Метод | Путь | Кто | Назначение |
|---|---|---|---|
| `GET` | `/collections` | auth | `mine` + `catalog` (без mine), `q` search по title |
| `POST` | `/collections` | admin | создать `{ title }` |
| `GET` | `/collections/:id` | auth | детали + words + progress (если mine) |
| `PATCH` | `/collections/:id` | admin | `{ title }` |
| `PATCH` | `/collections/:id/status` | admin | `{ status: ready \| inactive }`; ready требует ≥1 слово; inactive снимает membership + provenance |
| `DELETE` | `/collections/:id` | admin | удалить коллекцию; membership cascade; словарь не чистить |
| `POST` | `/collections/:id/words` | admin | `{ wordId }` → item; sync add подписчикам |
| `POST` | `/collections/:id/words/new` | admin | `WordDraft` → create/reuse catalog Word + item; sync подписчикам |
| `DELETE` | `/collections/:id/words/:wordId` | admin | убрать из состава; словарь не чистить |
| `POST` | `/collections/:id/add` | auth | membership + ensure cards |
| `DELETE` | `/collections/:id/add` | auth | remove membership + purge introduced untrained |
| `POST` | `/collections/:id/trainers` | auth + mine | создать trainer до 12 готовых; ответ как session |

Точные DTO — в `packages/contracts` на этапе реализации.

### Ensure card при add / admin sync

В транзакции:

1. upsert membership при user add;
2. для каждого `wordId` состава без `UserCard` пользователя:
   create `UserCard` (`source: manual`, `inDictionary: true`) +
   provenance row;
3. существующие карточки не обновлять.

Квоты / OpenAI / ElevenLabs / Unsplash не вызывать.

### Выбор слов для trainer

Переиспользовать `compareByPriority` из
[`apps/api/src/training/selection.ts`](../../apps/api/src/training/selection.ts)
(`MAX_TRAINER_WORDS = 12`). Готовность — `isWordReadyForTrainer`.

Сессия хранится как `DailyTrainer` с `kind = collection` в дне Madrid
пользователя; `GET|POST /training/trainers/:id` без изменений. В
`GET /training/today` и в `nextTrainerId` после complete kind
`collection` **не** показывается.

## Ежедневный пул

Изменений схемы `UserCardSource` нет: коллекционные первичные карточки =
`manual`. Сборка дня в `training.service` / `selection.ts` без нового
источника; уроковые флаги по-прежнему из membership курсов.

При реализации прогнать `selection.spec.ts` и сценарии:

- manual из коллекции в Recent-14 слотах 1–2;
- карточка уже `lesson` + add коллекции → остаётся lesson / окна курса;
- extra weights без изменений.

## UI (ориентир)

- Меню: **Colecciones** → `/colecciones`.
- Список: блок mine, затем catalog + search.
- Деталка: `/colecciones/:id`.
- Admin controls на тех же страницах при `role === admin`.
- Train → существующий `/entrenamiento/:trainerId`.

## Тесты (минимум на этап внедрения)

- admin-only mutate;
- add idempotent; ensure manual + provenance;
- remove purges only introduced untrained; keeps pre-existing;
- admin delete collection keeps dictionaries;
- admin add word syncs to subscribers;
- trainer caps at 12 by priority;
- daily treats new collection cards as manual.
