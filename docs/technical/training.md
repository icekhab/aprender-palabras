# Ежедневные подборки (training)

## Границы этапа

Целевое поведение при курсах: уроковые окна только для **effectivelyActive**
курсов с membership `accepted` (см. [courses.md](./courses.md)); карточки
словаря всегда в пуле. До внедрения курсов — один currentLesson пользователя.

На текущем этапе реализации:

- при первом запросе в календарный день `Europe/Madrid`, если есть готовые
  карточки, формируется до пяти ежедневных тренажёров; без готовых карточек
  пустой день **не** создаётся (`canGenerate: true`);
- `POST /training/today/generate` явно формирует набор (или дописывает daily
  в уже существующий пустой день); идемпотентно, если daily уже есть;
- размер подборки: минимум 1, максимум 12 карточек;
- **Unstarted** (`completedTrainerCount = 0`) попадают **только** в слот 5;
  слоты 1–4 содержат только **Started**;
- слот 4 (**Repaso lejano**): Started с `anchor − lastTrainedAt ≥ 28 суток`,
  приоритет только по прогрессу (иначе random);
- окна Recent-14 / Age 28 и «давно учили» считаются от якоря
  `User.lastCompletedTrainerAt` (если `null` — от текущего момента);
- состав сохраняется и повторно отдаётся без перестановки;
- `GET /training/today` возвращает только незавершённые блоки;
- на главной при `canGenerate` показывается карточка «Generar entrenamientos»;
  секция скрыта, если видимых блоков 0 и генерировать нечего;
- клик по карточке открывает `/entrenamiento/:trainerId` (этап знакомства);
- вводные карточки только для слов с `completedTrainerCount = 0`;
- аудио слов в сессии — только из уже сохранённого `WordAudio`;
  **не** вызывать ElevenLabs / `ensureWordAudio` при старте тренажёра.

Проверочные упражнения и `POST /training/trainers/:id/complete` реализованы:
completion атомарно обновляет прогресс карточек, агрегаты и
`User.lastCompletedTrainerAt`.

## Якорь времени

| Поле | Описание |
|---|---|
| `User.lastCompletedTrainerAt` | момент последней полностью завершённой тренировки |

Окна `addedAt` и `lastTrainedAt` сравниваются с этим якорем, чтобы долгий
перерыв не сдвигал все категории разом.

## Модели

См. также дополнения `UserCard` (`lastTrainedAt`, `completedTrainerCount`,
`showCount`) и таблицы `DailyTrainingDay` / `DailyTrainer` / `DailyTrainerWord`.

## REST API

### `GET /training/today`

Get-or-create набора на текущий день Madrid. Если готовых карточек нет и дня
ещё нет — день не создаётся, `canGenerate: true`.

Ответ `200`:

```json
{
  "date": "2026-10-19",
  "readyCardCount": 42,
  "canGenerate": false,
  "trainers": [
    {
      "id": "trainer-uuid",
      "kind": "daily",
      "slot": 1,
      "sourceLabel": "Lección actual",
      "wordCount": 10,
      "words": [
        {
          "userCardId": "card-uuid",
          "wordId": "word-uuid",
          "spanish": "esperar",
          "russian": "ждать",
          "progress": 50
        }
      ]
    }
  ]
}
```

`trainers` — только `status=not_started`.
`canGenerate` — `true`, если на сегодня ещё нет ни одного daily-тренажёра.

### `POST /training/today/generate`

Явно формирует daily-набор на сегодня (создание дня или дописка в пустой день).
Если daily уже есть — возвращает текущий today без дублей. Ответ как у
`GET /training/today`.

### `GET /training/trainers/:id`

Сессия незавершённого тренажёра текущего пользователя.

Ответ `200`:

```json
{
  "id": "trainer-uuid",
  "kind": "daily",
  "slot": 1,
  "sourceLabel": "Lección actual",
  "words": [
    {
      "userCardId": "card-uuid",
      "wordId": "word-uuid",
      "completedTrainerCount": 0,
      "showIntro": true,
      "progress": 0,
      "spanish": "esperar",
      "russian": "ждать",
      "additionalTranslations": ["ожидать"],
      "definitionEs": "…",
      "examples": ["Espero tu llamada."],
      "partOfSpeech": "verbo",
      "gender": null,
      "wrongRussian": ["a", "b", "c"],
      "wrongSpanish": ["x", "y", "z"],
      "imageUrl": null,
      "imagePhotographerName": null,
      "imagePhotographerUrl": null,
      "imagePageUrl": null,
      "imageProvider": null
    }
  ]
}
```

`404`, если тренажёр не найден, принадлежит другому пользователю или уже `completed`.
`showIntro` = `completedTrainerCount === 0`.

### `POST /training/trainers/:id/complete`

Сохраняет результат завершённого запуска. Тело:

```json
{
  "cards": [
    { "userCardId": "card-uuid", "errorCount": 1 }
  ]
}
```

`cards` должно содержать ровно все карточки тренажёра (без дублей).
`errorCount` — число неправильных попыток упражнений 1/3/4/5 по карточке
в этом запуске (упражнение 2 не учитывается).

В одной транзакции:

- `UserCard.progress` по формуле 0/1/2/3+ → +20/+10/−10/−20 (clamp 0–100);
- `lastTrainedAt`, `completedTrainerCount++`, `showCount++`;
- `DailyTrainer.status = completed`;
- `User.lastCompletedTrainerAt = now`.

Ответ `200`:

```json
{
  "cards": [
    {
      "userCardId": "card-uuid",
      "spanish": "esperar",
      "russian": "ждать",
      "errorCount": 1,
      "oldProgress": 40,
      "delta": 30,
      "newProgress": 70
    }
  ],
  "wordCount": 1,
  "dailyTotal": 5,
  "dailyCompleted": 2,
  "nextTrainerId": "next-trainer-uuid"
}
```

`nextTrainerId` — следующий `not_started` (daily или extra); `null`, если на день
больше нечего запускать. После завершения всех daily при необходимости
создаётся extra (как в `GET /today`).

`400` — невалидное тело или набор карточек не совпадает с тренажёром.
`404` — тренажёр не найден / чужой.
`409` — тренажёр уже `completed`.
