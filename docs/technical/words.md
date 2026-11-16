# Слова (глобальная база и личный словарь)

## Границы функции

На текущем этапе:

- suggestions обогащаются `wordId` / `progress` из `Word` и `UserCard`
  (см. [suggestions.md](./suggestions.md));
- если пары нет в БД: **admin/teacher** — preview → форма → save;
  **user** — `POST /words/generate` (async): сразу `UserCard` + stub `Word`,
  контент в фоне (квота gen при enqueue);
- если пара есть — «+» → `POST /words/existing` (без OpenAI/Unsplash/TTS);
  для user на пару в статусе `generating`/`failed` тот же `POST /words/generate`
  только цепляет `UserCard` к общему `Word` (без квоты / без второй генерации);
- генерация: OpenAI + Unsplash; TTS (ElevenLabs) при готовности нового
  `Word`; trainer/speech **не** вызывают ensure/generate TTS;
- `canEdit`: `admin` — любые; `teacher` — только `createdByUserId === me`;
  `user` — никогда; иначе `PATCH` → `403`, без карандаша;
- admin: «Todas las palabras» → каталог; edit по `wordId`; в шапке —
  suggestions (add в общий `Word` без `UserCard`); фильтр списка отдельно;
- картинки: create + `POST /words/image/regenerate` без per-word лимита;
  дневные квоты gen/suggestions — [quotas.md](./quotas.md);
- лимиты основной пары: ES 1–100 символов / ≤10 слов; RU 1–120 символов;
- воспроизведение — из `WordAudio` mp3.

## Модель `Word`

Уникальность пары: `normalizedSpanish` + `normalizedRussian`
(trim, схлопывание пробелов, lower case; `ñ` и акценты сохраняются).

Поиск подсказок по БД: `searchSpanish` + `searchRussian`
(`normalizeSearchKey`: lower + снятие диакритики NFD + `ё`→`е`;
`cárcel` → `carcel`, `niño` → `nino`). Уникальность не затрагивают.
Существующие строки заполнены миграцией backfill; create/update пишут
из `normalizeSearchKey`.

Поля: испанский текст, основной русский перевод, дополнительные переводы,
определение на испанском, примеры, часть речи, род, до десяти неверных вариантов
каждого направления (для задания выбираются 3 случайных), URL изображения и
атрибуция Unsplash, **`createdByUserId`**
(0..3), **`generationStatus`** (`generating` | `ready` | `failed`),
**`generationStartedAt`**, **`generationAttemptCount`**, **`generationError`**.
При создании новой пары — текущий пользователь; при reuse владельца
не менять. Существующие слова после миграции — `ready`.

Часть речи: при user auto-add, если AI не вернул значение из
`PART_OF_SPEECH_OPTIONS`, сохраняется sentinel `no determinada`
(`PART_OF_SPEECH_UNDETERMINED`); на просмотре и в тренажёре поле скрыто.
Для admin/teacher формы sentinel не предлагается — нужна категория из списка.
Готовность к тренировке от части речи не зависит.

Backfill: автор = seed-admin.

`createdViaLesson` пишется при create из урока (для аудита / курсов);
на `canEdit` влияет только роль и `createdByUserId` (см.
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
      "generationStatus": "ready",
      "addedAt": "2026-10-18T12:00:00.000Z"
    }
  ]
}
```

`averageProgress` — округлённое среднее `progress` по всем карточкам словаря
(не только по текущей странице и не по результатам `q`). Если карточек нет — `0`.
`generationStatus` — статус генерации глобального `Word`.

### `GET /words/:cardId`

Возвращает полную карточку `UserCard` текущего пользователя: поля слова,
`generationStatus`, прогресс, `ready` / `missingFields`, `canEdit`
(admin или teacher-создатель), список уроков пользователя, в которых есть
это слово. Карточки с `generationStatus !== ready` не считаются готовыми
к тренажёру (`ready=false`).

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

**UI (`/admin/words`):**

- шапка: поиск suggestions («Buscar para añadir») — как на главной, но
  результат идёт в **общий каталог**: нет `wordId` → `/admin/words/new?…`
  (preview → форма → `POST /admin/words` → редирект на список); есть
  `wordId` → edit («En catálogo»), без `POST /words/existing`;
- **Importar CSV** → `/admin/words/import` (и из детали коллекции с
  `?collectionId=`): UTF-8 CSV, заголовок обязателен, ≤50 валидных строк;
  колонки `spanish,russian,definitionEs,examples,partOfSpeech,gender,wrongRussian,wrongSpanish,unsplashQuery`
  (списки через `|`); без URL картинки. `unsplashQuery` — английская фраза
  Unsplash (опционально). Очередь в `sessionStorage` →
  `/admin/words/import/run`: для каждой строки `GET /admin/words/by-pair`;
  существующая пара — skip (каталог) или `POST /collections/:id/words`
  (коллекция); новая с **полным** текстом CSV —
  `POST /words/image/regenerate` (с `unsplashQuery` из CSV, если есть;
  без OpenAI content); иначе `POST /words/preview` + merge CSV, форма,
  `POST /admin/words` или `POST /collections/:id/words/new`, затем
  следующая. Финал → `/admin/words` или `/colecciones/:id`.
- ниже списка: фильтр каталога (`q`) + сортировка Actualización / Alta;
  в строке Act. / Alta (дата+время); клик → edit по `wordId`.

**API:**

- `GET /admin/words` — пагинация (`limit`/`offset`); query `q` (подстрока
  es/ru, без учёта регистра); `sortBy=updatedAt|createdAt` (default
  `updatedAt`, всегда `DESC`). `totalCount` — по всему каталогу (без `q`);
  `hasMore` — по совпадениям с фильтром. В items: `createdAt`, `updatedAt`.
- `GET /admin/words/by-pair?spanish=&russian=` — `{ wordId }` по
  нормализованной паре; `404` если нет. Для CSV-импорта (skip/link).
- `POST /admin/words` — создать `Word` **без** `UserCard`
  (тело как draft/`POST /words`); `409` + `wordId` если пара уже есть;
  TTS при новом слове; UI после успеха → список каталога.
- `GET /admin/words/:wordId` — полные поля слова для формы.
- `PATCH /admin/words/:wordId` — то же тело обновления контента, что у карточки;
  не требует `UserCard` админа на это слово.

Ошибки: `401`, `403` не admin, `404`, `409` на create.

Константа лимита CSV: `CSV_WORD_IMPORT_MAX_ROWS = 50` в contracts.
Пример шаблона UI: списки `examples` / `wrong*` через `|`; если колонка
заполнена, `examples` — 2–3, `wrong*` — 3–10. `unsplashQuery` — до 200
символов, английская фраза для Unsplash.

### `POST /words/image/search-query`

Тело: `{ "spanish", "russian" }`.

Возвращает английскую фразу поиска Unsplash через OpenAI (без квоты
картинок и без Unsplash). Для префилла попапа «Otra imagen», когда в форме
ещё нет `unsplashQuery`.

Успех `200`: `{ "unsplashQuery" }`. Ошибки: `400`, `503`.

### `POST /words/image/regenerate`

Тело: `{ "spanish", "russian", "unsplashQuery?", "excludeImageUrl?" }`.

Ищет до **8** кандидатов на Unsplash. Если передан `unsplashQuery` — ищет
по нему (без OpenAI); иначе генерирует фразу через OpenAI. Старается не
повторить `excludeImageUrl`. Без записи в БД. Первая картинка — выбранная.

Успех `200`: поля выбранного изображения + `imageDownloadLocation` +
`imageCandidates` + `unsplashQuery`.

Ошибки: `400`, `503` если сервисы недоступны.

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

Ответ `200`: полный draft карточки без записи в БД. Unsplash отдаёт до
**8** кандидатов в `imageCandidates`; поля `image*` — первая (выбранная);
`unsplashQuery` — фраза поиска. Кандидаты и query ephemeral (форма), в БД
не сохраняются. Если OpenAI или Unsplash недоступны, обязательная пара
возвращается, опциональные поля остаются пустыми. Используется форма
перед save.

### `POST /words/generate`

Тело: `{ "spanish", "russian" }` (как preview).

Для **user** auto-add:

1. если `Word` с парой уже есть — создать `UserCard` (если ещё нет) и вернуть
   `DictionaryListItem` с текущим `generationStatus` (без квоты, без новой
   генерации);
2. иначе списать квоту gen, создать stub `Word` (`generating`, attempt=1) +
   `UserCard`, сразу вернуть item, в фоне OpenAI → Unsplash → TTS → `ready`;
3. таймаут попытки ~90 с → `failed`;
4. job каждые 30 с: ретрай `failed` / stuck `generating` (>5 мин) пока
   `generationAttemptCount < 2`; после 2 попыток остаётся `failed`
   (admin re-generate — следующий этап).

Успех `200`: `DictionaryListItem` (включая `generationStatus`).
Ошибки: `400`, `401`, `409` карточка уже есть, `429` квота.

UI: строка в словаре сразу (иконка + tooltip при `generating`); карточка
поллит `GET /words/:cardId` раз в 5 с, пока статус `generating`.

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
progress, generationStatus, addedAt).

Ошибки: `400` невалидное тело, `401` нет сессии, `404` слова нет,
`409` карточка уже есть у пользователя.

### `POST /words`

Тело: draft по правилам `createWordSchema` (как `updateWordCardSchema`, но
`partOfSpeech` может быть `null` — тогда сохраняется sentinel
`no determinada`) + на сервере `additionalTranslations` обнуляется;
включая `imageDownloadLocation` для tracking Unsplash. PATCH карточки и
формы admin/teacher по-прежнему требуют `updateWordCardSchema` (POS из
списка обязателен).

Поведение:

1. найти `Word` по нормализованной паре;
2. если нет — создать из draft с `createdByUserId = currentUser`;
3. если у текущего пользователя уже есть `UserCard` на этот `Word` — `409`;
4. иначе создать `UserCard` с `source=manual`, `inDictionary=true`, `progress=0`.

При переиспользовании существующего `Word` его поля и `createdByUserId`
**не** перезаписываются draft’ом. `trackDownload` Unsplash вызывается
только когда создаётся **новый** `Word` с `imageProvider=unsplash`
(то же при create слова из урока).

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

Unsplash compliance: hotlink `photo.urls.regular`; при сохранении выбранного
изображения — `GET` на `links.download_location`; в UI атрибуция фотографа
(профиль + UTM) и ссылка «Unsplash» на
`https://unsplash.com/?utm_source=aprender-palabras&utm_medium=referral`.
