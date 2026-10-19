# Ежедневные подборки (training)

## Границы этапа

На текущем этапе:

- при первом запросе в календарный день `Europe/Madrid` формируется до шести
  ежедневных тренажёров;
- размер подборки: минимум 1, максимум 15 карточек;
- **Unstarted** (`completedTrainerCount = 0`) попадают **только** в слот 6;
  слоты 1–5 содержат только **Started**;
- окна Recent-14 / Age 28 и «давно учили» считаются от якоря
  `User.lastCompletedTrainerAt` (если `null` — от текущего момента);
- состав сохраняется и повторно отдаётся без перестановки;
- `GET /training/today` возвращает только незавершённые блоки;
- на главной секция скрыта, если видимых блоков 0;
- клик по карточке пока ничего не делает.

Пока не реализовано: запуск тренажёра, упражнения, API завершения
(при completion нужно обновлять `lastCompletedTrainerAt`, прогресс карточек).

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

Get-or-create набора на текущий день Madrid.

Ответ `200`:

```json
{
  "date": "2026-10-19",
  "readyCardCount": 42,
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
