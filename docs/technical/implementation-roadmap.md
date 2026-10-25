# Дорожная карта: multi-user, курсы, квоты

Чеклист реализации всего, что согласовано в продуктовой и технической
документации. Идти **по порядку пунктов**: каждый блок опирается на
предыдущие. Регистрация в UI **не** входит — пользователи через миграции.

Спеки (читать перед пунктом):

| Тема | Product | Tech |
|---|---|---|
| Роли, auth | [README §3–5](../product/README.md) | [auth.md](./auth.md) |
| Слова, edit, admin-каталог | [01-words.md](../product/01-words.md) | [words.md](./words.md) |
| Квоты, TTS | [01-words §12](../product/01-words.md) | [quotas.md](./quotas.md) |
| Курсы | [05-courses.md](../product/05-courses.md) | [courses.md](./courses.md) |
| Тренажёр / пул | [03-daily-training.md](../product/03-daily-training.md) | [training.md](./training.md) |

Отмечай выполнение в этом файле (`[ ]` → `[x]`).

---

## 0. Подготовка

- [ ] Перечитать [05-courses.md](../product/05-courses.md), [quotas.md](./quotas.md), [auth.md](./auth.md).
- [ ] Решить порядок миграций на prod (бэкап БД перед сменой Lesson → Course).

---

## 1. Роли пользователя

**Цель:** `User.role = user | teacher | admin`.

- [x] Prisma: enum + поле `role` (default `user`).
- [x] Миграция: seed-пользователь → `admin`.
- [x] Локальный seed: `teacher@local.test` / `user@local.test` (пароль как у admin).
- [x] `AuthUser` / login / `GET /auth/me` возвращают `role`.
- [x] Документ «как выдать teacher миграцией» в [auth.md](./auth.md) актуален.
- [x] Тесты: me/login с role.

**Готово когда:** в ответе auth есть `role`; админ seed на месте.

---

## 2. Владение словом и право редактирования

**Цель:** ограничить PATCH контента `Word`; UI без карандаша без права.

- [x] Prisma: `Word.createdByUserId` (+ backfill на seed-admin).
- [x] При `word.create` писать `createdByUserId`; при reuse не менять.
- [x] Правило `canEdit`:
  - `admin` — любые слова;
  - `teacher` — только свои (`createdByUserId`);
  - `user` — никогда.
- [x] `UserCardDetail.canEdit`; `PATCH /words/:cardId` → `403` без права.
- [x] UI: `onEdit` только при `canEdit`; прямой `/edit` → редирект/ошибка.
- [x] Тесты прав.

**Ссылки:** [01-words §3, §8](../product/01-words.md), [words.md](./words.md).

**Готово когда:** `user` не правит контент; teacher — свои; admin — всё.

---

## 3. Admin-каталог слов

**Цель:** меню аватара → каталог; поиск suggestions добавляет в общую базу
(не в личный словарь); edit по `wordId`.

- [x] `GET/PATCH /api/admin/words` (+ get by id), guard `role === admin`.
- [x] `POST /api/admin/words` — создать `Word` без `UserCard`; `409` + `wordId`
  если пара есть; после save → список каталога.
- [x] Пункт «Todas las palabras» только для admin.
- [x] Список: `sortBy=updatedAt|createdAt` (default updatedAt DESC); в строке
  Act./Alta с датой и временем; фильтр каталога (`q`); `totalCount` без фильтра.
- [x] Шапка: GPT suggestions — новая пара → форма add в каталог; существующая
  → edit («En catálogo»), не в личный словарь.
- [x] Тесты 403 для non-admin / create без UserCard.

**Ссылки:** [words.md](./words.md) (admin API), [01-words WORD-17](../product/01-words.md).

---

## 4. TTS только при создании слова

**Цель:** убрать ElevenLabs из trainer / lazy speech; оставить только create.

- [ ] Удалить `ensureWordAudio` из training session / массового прогрева.
- [ ] `GET /speech/:wordId` — только чтение `WordAudio`; без генерации.
- [ ] Оставить TTS в create слова (поиск и урок курса).
- [ ] Тесты / ручная проверка: play без нового TTS; create пишет mp3.

**Ссылки:** [01-words §7](../product/01-words.md), [04-word-trainer](../product/04-word-trainer.md), [quotas.md](./quotas.md).

---

## 5. Квоты платных API

**Цель:** дневные лимиты + реген картинки ≤ 2; проверка **до** внешних вызовов.

- [ ] Prisma `User`: nullable
  `dailySearchGenerationLimit`, `dailyTotalGenerationLimit`,
  `dailySuggestionsLimit`; счётчики дня + `quotaDate` (Madrid).
- [ ] Prisma `Word.imageRegenerationCount` (0..2).
- [ ] Сервис квот: сброс по дате Madrid; admin без дневных gen/suggestions.
- [ ] Search-генерация: `search < 20` (или override) **и** `search+course < 100`.
- [ ] Course-генерация: `search+course < totalLimit`.
- [ ] `GET /suggestions` → счётчик suggestions (дефолт 300); `429` при лимите.
- [ ] Реген картинки: отказ после 2; инкремент при успешном регене.
- [ ] Тесты квот и override в БД.

**Ссылки:** [quotas.md](./quotas.md), [01-words §12](../product/01-words.md).

**Готово когда:** превышение лимита не бьёт в OpenAI/Unsplash/ElevenLabs.

---

## 6. UX добавления слова через поиск (по роли)

**Цель:** у `user` — generate + сразу в словарь без правки; у teacher/admin —
форма.

- [x] Frontend: `user` search — preview+create без формы (квота API — §5).
- [x] Admin/teacher — прежний preview → форма → save.
- [ ] Existing (`+`) без генерации / без квоты gen (уже так; квоты — §5).
- [x] После auto-add — без карандаша (`canEdit` у user = false).
- [ ] Тесты UX/API / серверный one-shot с квотой (§5).

**Ссылки:** [01-words §4](../product/01-words.md), [suggestions.md](./suggestions.md).

---

## 7. Схема курсов и миграция уроков

**Цель:** все уроки внутри Course; membership с current на участника.

- [ ] Prisma: `Course`, `CourseMembership`
  (`pending|accepted|completed`, `currentLessonId`).
- [ ] `Lesson.courseId`; убрать `Lesson.userId` / `User.currentLessonId`.
- [ ] Миграция данных: личный курс на пользователя с уроками; перенос
  current; last → `completed`.
- [ ] Создателям личных курсов выдать `teacher` или `admin`, иначе курсы
  сразу неэффективны ([05-courses §7, §9](../product/05-courses.md)).
- [ ] Прогнать миграцию на копии prod.

**Ссылки:** [courses.md](./courses.md), [05-courses §9](../product/05-courses.md).

---

## 8. API курсов (без UI)

**Цель:** CRUD, invite/accept/reject, current, complete, members; только teacher/admin.

- [ ] Guard: все `/courses*` → `403` для `user`.
- [ ] Create → self `accepted`; invite только на teacher/admin.
- [ ] Accept / reject (reject = delete membership).
- [ ] Current lesson + auto `completed` если last; ручной complete.
- [ ] Создатель меняет current/complete у другого member.
- [ ] `effectivelyActive = active AND creator.role ∈ {teacher,admin}`.
- [ ] Мутации на неэффективном курсе → `403`.
- [ ] Список invited-users / курсы user в контексте создателя.
- [ ] Перенос lessons API под `/courses/:id/lessons/...`.
- [ ] Добавление слова в урок: UX с правкой + course-квота (п. 5–6).
- [ ] E2E/integration тесты API.

**Ссылки:** [05-courses](../product/05-courses.md), [courses.md](./courses.md).

---

## 9. UI Cursos

**Цель:** испанский раздел курсов.

- [ ] Меню Cursos только для teacher/admin.
- [ ] `/cursos`: сверху pending accept/reject; список курсов
  (незавершённые эффективные сверху; Completado / деактивирован).
- [ ] `/cursos/:id`: уроки, свой current, complete; создатель — edit/invite.
- [ ] Деактивированный курс — read-only.
- [ ] Заменить плоский вход «Lecciones» на курсы → уроки.
- [ ] Тесты UI (меню, invite block, сортировка).

**Ссылки:** [05-courses §10](../product/05-courses.md).

---

## 10. UI создателя: участники и приглашённые

- [ ] Участники курса: не завершившие сверху; current/next / pending.
- [ ] Список всех приглашённых по своим курсам.
- [ ] Страница пользователя в контексте «мои курсы для него»:
  смена current / complete.
- [ ] На неэффективном курсе действия управления скрыты/запрещены.

**Ссылки:** [05-courses §10.3–10.4](../product/05-courses.md).

---

## 11. Ежедневный тренажёр: несколько курсов

**Цель:** уроковые окна только с effectivelyActive + accepted.

- [ ] `loadSelectionContext`: окна prev+current+next по всем таким курсам.
- [ ] Объединение + словарь (в т.ч. слова из деактивированных курсов).
- [ ] Не включать `completed` / `pending` / неэффективные в **уроковое** окно.
- [ ] Тесты selection / training.

**Ссылки:** [03-daily-training](../product/03-daily-training.md), [training.md](./training.md), [courses.md](./courses.md) §Тренажёр.

---

## 12. Demotion и ручная проверка ролей

- [ ] Сценарий: teacher создал курс → роль сменили на `user`:
  - у участников teacher/admin курс «деактивирован»;
  - нельзя менять current;
  - уроковое окно не в пуле;
  - слова в словаре всё ещё в тренировках;
  - у demoted нет Cursos.
- [ ] Invite на логин с ролью `user` → ошибка.
- [ ] `user` не открывает `/cursos` и получает `403` на API.

**Ссылки:** [05-courses §1.2, §7](../product/05-courses.md).

---

## 13. Финальная приёмка

Пройти критерии:

- [ ] WORD-08, WORD-17, WORD-18, WORD-19 ([01-words](../product/01-words.md)).
- [ ] COURSE-01 … COURSE-17 ([05-courses §12](../product/05-courses.md)).
- [ ] DAILY-17 ([03-daily-training](../product/03-daily-training.md)).
- [ ] Lint / typecheck / test / build перед деплоем.

---

## Вне скоупа (намеренно)

- Self-registration, email verify, password reset, magic link.
- Invite пользователей без аккаунта / без teacher|admin.
- Отдельная квота TTS (покрыта квотой add).
- Полноценная админ-панель кроме каталога слов.
- CI/CD (как и раньше — локальные проверки перед push).

---

## Рекомендуемый порядок сессий

| Сессия | Пункты |
|---|---|
| 1 | §1–3 (роли, edit, admin catalog) |
| 2 | §4–6 (TTS, квоты, search UX) |
| 3 | §7–8 (схема + API курсов) |
| 4 | §9–10 (UI курсов) |
| 5 | §11–13 (training + demotion + приёмка) |
