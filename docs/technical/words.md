# Слова (глобальная база и личный словарь)

## Границы функции

На текущем этапе:

- suggestions обогащаются `wordId` / `progress` из `Word` и `UserCard`
  (см. [suggestions.md](./suggestions.md));
- если пары нет в БД: **admin** — полный preview/edit/save; **не-admin** —
  generate+create в одном шаге без UI правки (квота gen до внешних API);
- если пара есть — «+» → `POST /words/existing` (без OpenAI/Unsplash/TTS);
- генерация: OpenAI + Unsplash; TTS (ElevenLabs) **только** при create нового
  `Word`; trainer/speech **не** вызывают ensure/generate TTS;
- `canEdit`: `admin` **или** слово добавлено текущим пользователем через
  урок курса; иначе `PATCH` → `403`, без карандаша;
- admin: «Todas las palabras» → каталог `createdAt DESC`; edit по `wordId`;
- реген картинки: `POST /words/image/regenerate`, max **2** на `Word`
  (`imageRegenerationCount`); квоты — [quotas.md](./quotas.md);
- воспроизведение — из `WordAudio` mp3.

## Модель `Word`

Уникальность пары: `normalizedSpanish` + `normalizedRussian`
(trim, схлопывание пробелов, lower case; `ñ` сохраняется).

Поля: испанский текст, основной русский перевод, дополнительные переводы,
определение на испанском, примеры, часть речи, род, до десяти неверных вариантов
каждого направления (для задания выбираются 3 случайных), URL изображения и
атрибуция Unsplash, **`createdByUserId`**, **`imageRegenerationCount`**
(0..2). При создании новой пары — текущий пользователь; при reuse владельца
не менять.

Backfill: автор = seed-admin; `imageRegenerationCount = 0`.

Флаг происхождения для `canEdit` у не-admin: слово создано/привязано через
урок курса этим пользователем (деталь реализации — при коде; продукт:
[01-words.md](../product/01-words.md) §3).

## Модель `UserCard`

Личная карточка пользователя, ссылающаяся на глобальный `Word`.

| Поле | Описание |
|---|---|
| `userId` + `wordId` | уникальная пара: один пользователь — одна карточка на слово |
| `source` | `manual` (самостоятельно) или `lesson` (на будущее) |
| `inDictionary` | входит ли в личный словарь (`true` для самостоятельного добавления) |
| `progress` | изученность 0–100%, при создании `0` |
| `lastTrainedAt` | дата последней завершённой тренировки |
| `completedTrainerCount` | число завершённых тренажёров с карточкой |
| `showCount` | число показов в завершённых тренажёрах |
| `addedAt` | дата добавления |

У `User` также есть `lastCompletedTrainerAt` — якорь для окон ежедневных
подборок (см. [training.md](./training.md)).

Удаление `User` каскадно удаляет его `UserCard`. Удаление `Word` запрещено,
пока на него ссылаются карточки (`ON DELETE RESTRICT`).

## REST API

Все маршруты под префиксом `/api`. Требуется активная сессия.

### `GET /words`

Query: `limit` (1–50, по умолчанию 20), `offset` (>= 0, по умолчанию 0),
опциональный `q` (до 100 символов, trim; пустая строка игнорируется).

Возвращает карточки текущего пользователя с `inDictionary=true`, сортировка
`addedAt DESC`. При непустом `q` в `items` остаются только карточки, у которых
испанский или русский текст содержит подстроку без учёта регистра.
`totalCount` и `averageProgress` всегда по всему личному словарю (без `q`);
`hasMore` — по числу совпадений с учётом фильтра.

Ответ `200`:

```json
{
  "totalCount": 21,
  "averageProgress": 50,
  "hasMore": true,
  "items": [
    {
      "id": "card-uuid",
      "wordId": "word-uuid",
      "spanish": "esperar",
      "russian": "ждать",
      "progress": 0,
      "addedAt": "2026-10-18T12:00:00.000Z"
    }
  ]
}
```

`averageProgress` — округлённое среднее `progress` по всем карточкам словаря
(не только по текущей странице и не по результатам `q`). Если карточек нет — `0`.

### `GET /words/:cardId`

Возвращает полную карточку `UserCard` текущего пользователя: поля слова,
прогресс, `ready` / `missingFields`, `canEdit` (создатель слова или admin),
список уроков пользователя, в которых есть это слово.

Ошибки: `401` нет сессии, `404` карточки нет или она чужая.

### `PATCH /words/:cardId`

Обновляет поля глобального `Word`, на который ссылается карточка пользователя,
только если `canEdit`. Иначе `403`.

Тело: `UpdateWordCardInput` — `spanish` (только для проверки, должен совпадать
с текущим), `russian`, `definitionEs`, `examples` (2–3), `partOfSpeech`
(из фиксированного списка), `gender` (обязателен для `sustantivo`, иначе `null`),
`wrongRussian` / `wrongSpanish` (≥3, ≤10), поля изображения.

Успех `200`: обновлённый `UserCardDetail`.

Ошибки: `400` невалидное тело / смена испанского, `401`, `403` нет права,
`404`, `409` если новая пара `(spanish, russian)` уже занята другим `Word`.

### Admin: каталог слов

Только `role === admin`.

- `GET /admin/words` — пагинация, сортировка `createdAt DESC` (новые сверху).
- `GET /admin/words/:wordId` — полные поля слова для формы.
- `PATCH /admin/words/:wordId` — то же тело обновления контента, что у карточки;
  не требует `UserCard` админа на это слово.

Ошибки: `401`, `403` не admin, `404`.

### `POST /words/image/regenerate`

Тело: `{ "spanish", "russian", "excludeImageUrl?" }`.

Генерирует Unsplash-запрос через OpenAI и возвращает новое изображение
(стараясь не повторить `excludeImageUrl`). Без записи в БД.

Успех `200`: поля изображения + `imageDownloadLocation`; инкремент
`imageRegenerationCount` при успешном регене, сохраняемом в БД (или при
вызове — зафиксировать при реализации согласно продукту: лимит на успешные
регены, попавшие в слово).

Ошибки: `400`, `429` если уже 2 регена, `503` если сервисы недоступны.

### `POST /words/:cardId/reset-progress`

Сбрасывает прогресс и счётчики тренировки, как у только что добавленной
карточки: `progress=0`, `lastTrainedAt=null`, `completedTrainerCount=0`,
`showCount=0`. Состав уже созданных ежедневных подборок не меняется.

Успех `200`: обновлённый `UserCardDetail`.

### `DELETE /words/:cardId`

Удаляет `UserCard` пользователя и все связи этого слова с его уроками.
Записи в незавершённых тренажёрах каскадно снимаются. Общий `Word` в базе
не удаляется. После удаления слово можно снова добавить как новое.

Успех `204`. Ошибки: `401`, `404`.

### `POST /words/preview`

Тело:

```json
{
  "spanish": "esperar",
  "russian": "ждать"
}
```

Ответ `200`: полный draft карточки без записи в БД. Если OpenAI или Unsplash
недоступны, обязательная пара возвращается, опциональные поля остаются пустыми.

### `POST /words/existing`

Тело:

```json
{
  "wordId": "word-uuid"
}
```

Создаёт `UserCard` на уже существующий `Word` без preview/AI/Unsplash:
`source=manual`, `inDictionary=true`, `progress=0`.

Успех `200`: `DictionaryListItem` (id карточки, wordId, spanish, russian,
progress, addedAt).

Ошибки: `400` невалидное тело, `401` нет сессии, `404` слова нет,
`409` карточка уже есть у пользователя.

### `POST /words`

Тело: полный draft по правилам `updateWordCardSchema` (обязательные поля
как при редактировании) + на сервере `additionalTranslations` обнуляется;
включая `imageDownloadLocation` для tracking Unsplash.

Поведение:

1. найти `Word` по нормализованной паре;
2. если нет — создать из draft с `createdByUserId = currentUser`;
3. если у текущего пользователя уже есть `UserCard` на этот `Word` — `409`;
4. иначе создать `UserCard` с `source=manual`, `inDictionary=true`, `progress=0`.

При переиспользовании существующего `Word` его поля и `createdByUserId`
**не** перезаписываются draft’ом.

Успех `200`: слово (`Word`) с `id` и timestamps.

Ошибки:

| Статус | Когда |
|---|---|
| `400` | невалидное тело / query |
| `401` | нет сессии |
| `409` | карточка уже есть у этого пользователя |

## Переменные окружения

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-6-sol
UNSPLASH_ACCESS_KEY=
```

Нужен только Unsplash Access Key. Secret Key не используется.
Ключи хранятся только на backend.
