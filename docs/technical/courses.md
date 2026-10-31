# Курсы (целевая техническая спецификация)

Продуктовое поведение: [product/05-courses.md](../product/05-courses.md).
До внедрения код и схема могут не соответствовать.

## Доступ по ролям

Create / update / invite / content mutate — `role ∈ { teacher, admin }`
(`403` для `user`). List / accept / reject / свой current — любой auth.

Invite: целевой пользователь должен существовать (любая роль), иначе
ошибка без создания membership.

## Эффективная активность

```text
effectivelyActive =
  course.active
  AND creator.role IN (teacher, admin)
```

Мутации current / invite / content — только если `effectivelyActive`
(и права создателя/участника). Иначе `403`.

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
| `status` | `pending` \| `accepted` |
| `currentLessonId` | nullable FK на `Lesson` того же курса |
| `invitedAt` / `acceptedAt` | |

- `POST /courses` → только teacher/admin; создатель видит курс без обязательного membership.
- Reject → удаление строки membership.
- Отдельного статуса `completed` нет; current = last не меняет status.

### `Lesson`

- `courseId`, позиция в курсе.
- Убрать `Lesson.userId` / `User.currentLessonId`.
- Current — на membership.

Миграция: личный курс на пользователя с уроками; при необходимости выдать
ему `teacher` или оставить курсы неэффективными до назначения роли.

## REST API (эскиз)

Префикс `/api`. Сессия (auth). Create/update/invite/content — teacher/admin.

| Метод | Путь | Кто | Назначение |
|---|---|---|---|
| `POST` | `/courses` | teacher/admin | создать курс |
| `GET` | `/courses?view=student\|creator` | любой auth; `creator` → teacher/admin | student: pending + accepted; creator: только createdBy |
| `GET` | `/courses/:id` | создатель или accepted member | детали |
| `PATCH` | `/courses/:id` | создатель | title, active (если effectivelyActive или смена active) |
| `POST` | `/courses/:id/invite` | создатель | login → pending; self → accepted сразу |
| `POST` | `/courses/:id/accept` | invitee pending | accepted + sync словаря |
| `POST` | `/courses/:id/reject` | invitee pending | delete membership |
| `DELETE` | `/courses/:id/members/:userId` | self / создатель | удалить membership; словарь не трогаем |
| `GET` | `/courses/:id/members` | создатель | pending → не на last → на last |
| `PATCH` | `/courses/:id/members/:userId/current-lesson` | self / создатель | current |
| `GET` | `/courses/invited-users` | создатель | все приглашённые |
| `GET` | `/courses/invited-users/:userId` | создатель | мои курсы для user |
| | `/courses/:id/lessons/...` | создатель write; member read | lessons |

Ошибки: `403` нет роли / курс неэффективен для мутации; `404` user;
`400` нет уроков / уже member.

## UI-маршруты

Cursos у всех auth; create/Alumnos — teacher/admin.

| Путь (пример) | Экран |
|---|---|
| `/cursos` | Mis cursos (ученик): invites + accepted |
| `/cursos/:id` | режим ученика: прогресс / current / Salir |
| `/cursos/gestion` | Gestión de cursos: список + Nuevo / Alumnos |
| `/cursos/gestion/:id` | режим создателя: edit / Participantes |
| `/cursos/gestion/:id/participantes` | участники |
| `/cursos/alumnos` | все ученики (приглашённые) |
| `/cursos/alumnos/:userId` | курсы этого user от меня |

## Тренажёр

1. Memberships: `accepted`, курс **effectivelyActive**.
2. Окна prev/current/next → объединение.
3. Plus все `UserCard` словаря (включая слова из уже неэффективных курсов).
4. Слоты — [training.md](./training.md).

Demotion / `active=false` не удаляет UserCard.

## Контент

Мутации уроков/слов в курсе — создатель при effectivelyActive.
Поля `Word` — [words.md](./words.md) / квоты [quotas.md](./quotas.md).
