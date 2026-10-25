# Курсы (целевая техническая спецификация)

Продуктовое поведение: [product/05-courses.md](../product/05-courses.md).
До внедрения код и схема могут не соответствовать.

## Доступ по ролям

Все маршруты `/api/courses*` требуют `role ∈ { teacher, admin }` (`403`
для `user`). UI раздела Cursos скрыт для `user`.

Invite: целевой пользователь должен существовать и иметь
`role ∈ { teacher, admin }`, иначе ошибка без создания membership.

## Эффективная активность

```text
effectivelyActive =
  course.active
  AND creator.role IN (teacher, admin)
```

Мутации current / complete / invite / content — только если
`effectivelyActive` (и права создателя/участника). Иначе `403`.

В списке курсов неэффективные отдавать с флагом `effectivelyActive: false`
(UI — деактивирован).

## Модели

### `Course`

| Поле | Описание |
|---|---|
| `id` | UUID |
| `title` | название |
| `createdByUserId` | создатель |
| `active` | явный флаг набора; `true` по умолчанию |
| `createdAt` | |

### `CourseMembership`

| Поле | Описание |
|---|---|
| `courseId` + `userId` | уникальная пара |
| `status` | `pending` \| `accepted` \| `completed` |
| `currentLessonId` | nullable FK на `Lesson` того же курса |
| `invitedAt` / `acceptedAt` / `completedAt` | |

- `POST /courses` → self membership `accepted` (только teacher/admin).
- Reject → удаление строки membership.
- `completed`: ручной complete или current = last lesson.
- Смена current на не-last при `completed` → снова `accepted`.

### `Lesson`

- `courseId`, позиция в курсе.
- Убрать `Lesson.userId` / `User.currentLessonId`.
- Current — на membership.

Миграция: личный курс на пользователя с уроками; при необходимости выдать
ему `teacher` или оставить курсы неэффективными до назначения роли.

## REST API (эскиз)

Префикс `/api`. Сессия + teacher/admin.

| Метод | Путь | Кто | Назначение |
|---|---|---|---|
| `POST` | `/courses` | teacher/admin | создать + self accepted |
| `GET` | `/courses` | teacher/admin | курсы + pending; флаг effectivelyActive |
| `GET` | `/courses/:id` | создатель или member | детали |
| `PATCH` | `/courses/:id` | создатель | title, active (если effectivelyActive или смена active) |
| `POST` | `/courses/:id/invite` | создатель | login → pending; target teacher/admin |
| `POST` | `/courses/:id/accept` | invitee pending | accepted + sync словаря |
| `POST` | `/courses/:id/reject` | invitee pending | delete membership |
| `POST` | `/courses/:id/members/:userId/complete` | self / создатель | completed |
| `GET` | `/courses/:id/members` | создатель | незавершившие первыми |
| `PATCH` | `/courses/:id/members/:userId/current-lesson` | self / создатель | current |
| `GET` | `/courses/invited-users` | создатель | все приглашённые |
| `GET` | `/courses/invited-users/:userId` | создатель | мои курсы для user |
| | `/courses/:id/lessons/...` | создатель write; member read | lessons |

Ошибки: `403` нет роли / курс неэффективен для мутации; `404` user;
`400` нет уроков / уже member / target не teacher|admin.

## UI-маршруты

Только если `role` teacher/admin.

| Путь (пример) | Экран |
|---|---|
| `/cursos` | invites + список |
| `/cursos/:id` | уроки / current / complete / invite |
| `/cursos/:id/participantes` | участники |
| `/cursos/invitados` | все приглашённые |
| `/cursos/invitados/:userId` | курсы этого user от меня |

## Тренажёр

1. Memberships: `accepted`, курс **effectivelyActive**.
2. Окна prev/current/next → объединение.
3. Plus все `UserCard` словаря (включая слова из уже неэффективных курсов).
4. Слоты — [training.md](./training.md).

Demotion / `active=false` не удаляет UserCard.

## Контент

Мутации уроков/слов в курсе — создатель при effectivelyActive.
Поля `Word` — [words.md](./words.md) / квоты [quotas.md](./quotas.md).
