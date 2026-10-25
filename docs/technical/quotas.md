# Квоты платных API (целевая спецификация)

Продукт: [01-words.md](../product/01-words.md), [suggestions.md](./suggestions.md).
День квот — календарный день `Europe/Madrid`.

## Что стоит денег

| Сервис | Когда вызывается |
|---|---|
| OpenAI | генерация содержимого карточки; запрос фразы для Unsplash при регене картинки; `GET /suggestions` |
| Unsplash | поиск картинки при генерации / регене |
| ElevenLabs | **только** при создании нового `Word` (добавление через поиск или урок курса) |

TTS **не** вызывается из trainer, lazy `GET /speech` или прогрева сессии.
Если `WordAudio` нет — ошибка/тишина без ElevenLabs. Отдельная квота TTS
не нужна: речь идёт только в пути add, уже ограниченном квотой генераций.

`POST /words/existing` (пара уже в БД) внешние API не вызывает и квоту
генераций не тратит.

## Дневные квоты (не-admin)

| Квота | Дефолт | Условие ошибки |
|---|---:|---|
| Генерации через поиск | 20 | `searchCount >= searchLimit` |
| Генерации всего (поиск + курсы) | 100 | `searchCount + courseCount >= totalLimit` |
| Suggestions | 300 | `suggestionsCount >= suggestionsLimit` |

Перед любым платным вызовом проверить квоту; при исчерпании — ответ с
ошибкой дневной квоты (**без** вызова внешнего API), счётчик не увеличивать
за неудачный отказ по квоте. После успешного (или начатого по политике
реализации — зафиксировать: инкремент **перед** вызовом после прохождения
проверки, чтобы параллельные запросы не обходили лимит) — инкремент.

**admin** дневные квоты gen/suggestions не применяет.

## Лимит на слово (все роли, включая admin)

| Лимит | Значение |
|---|---:|
| Регенерации картинки на один `Word` | 2 за всё время жизни записи |

Поле `Word.imageRegenerationCount`. Третий вызов → ошибка без OpenAI/Unsplash.

## Поля `User` (override)

`null` = использовать дефолт:

- `dailySearchGenerationLimit`
- `dailyTotalGenerationLimit`
- `dailySuggestionsLimit`

Счётчики текущего дня (сброс при смене даты Madrid), например:

- `quotaDate` (date Madrid)
- `searchGenerationsCount`
- `courseGenerationsCount`
- `suggestionsCount`

## Эндпоинты под квотами

| Эндпоинт | Квота |
|---|---|
| Генерация+создание слова из поиска (non-admin auto-add / admin preview+create) | search + total |
| Генерация при добавлении слова в урок курса | course + total |
| `POST /words/image/regenerate` | `imageRegenerationCount` на Word |
| `GET /suggestions` (ветка с OpenAI) | suggestions |

Проверка search-генерации: одновременно `search < searchLimit` и
`search + course < totalLimit`. Course-генерация: `search + course < totalLimit`
(отдельного «course-only» потолка нет; search дополнительно ограничен 20).
