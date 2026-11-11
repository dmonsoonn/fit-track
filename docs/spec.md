# FitTrack — спецификация

Полное описание системы: данные, API, экраны, бизнес-правила. Описано фактическое поведение кода на момент последнего обновления. Если код и этот документ расходятся, истина — код; документ нужно поправить.

---

## Обзор

Многопользовательская веб-платформа для ведения клиентов фитнес-тренером: тренировочные программы, тренировки с упражнениями, фиксация результатов, дневник питания, уведомления, шаблоны сообщений.

**Роли:** `client` · `trainer` · `admin`
**Архитектура:** SPA (React) + REST API (Go/Fiber) + PostgreSQL + S3 (MinIO)
**Аутентификация:** JWT (HS256) + bcrypt (cost 12) + RBAC-middleware

---

## База данных

PostgreSQL 16. Схема описывается SQL-файлами в `backend/internal/db/migrations/` (`NNN_name.up.sql` / `.down.sql`).

### Миграции

- Свой раннер в `backend/internal/db/postgres.go`, golang-migrate не используется.
- Файлы встроены в бинарник через `go:embed`.
- Применяются автоматически при старте сервера (`cmd/server`) и seed (`cmd/seed`): все `*.up.sql` по возрастанию номера, каждая в своей транзакции; применённые версии пишутся в `schema_migrations (version, applied_at)`.
- `*.down.sql` раннер не вызывает — откат только вручную.
- Новая миграция: следующий номер, пара `NNN_name.up.sql` + `NNN_name.down.sql`. Уже применённые файлы не редактировать.

### Схема (миграции 001 + 002)

```sql
CREATE TYPE user_role         AS ENUM ('admin', 'trainer', 'client');
CREATE TYPE fitness_level     AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE workout_status    AS ENUM ('planned', 'completed', 'skipped');
CREATE TYPE template_scope    AS ENUM ('system', 'trainer', 'client');
CREATE TYPE template_type     AS ENUM ('confirmation', 'reschedule', 'feedback');
CREATE TYPE notification_type AS ENUM ('workout_assigned', 'workout_completed', 'message');

CREATE TABLE users (
    user_id       BIGSERIAL    PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          user_role    NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX idx_users_email ON users (LOWER(email));

CREATE TABLE trainers (
    trainer_id     BIGSERIAL    PRIMARY KEY,
    user_id        BIGINT       NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    specialization VARCHAR(255),
    invite_code    VARCHAR(20)  NOT NULL UNIQUE
);

CREATE TABLE clients (
    client_id     BIGSERIAL    PRIMARY KEY,
    user_id       BIGINT       NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    trainer_id    BIGINT       NOT NULL REFERENCES trainers(trainer_id),
    goal          VARCHAR(255),
    weight        NUMERIC(5,2) CHECK (weight > 0),
    height        NUMERIC(5,2) CHECK (height > 0),
    level         fitness_level,
    health_notes  VARCHAR(255),
    date_of_birth DATE
);

CREATE TABLE workout_plans (
    workout_plan_id BIGSERIAL    PRIMARY KEY,
    client_id       BIGINT       NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
    title           VARCHAR(100) NOT NULL,
    description     VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    end_date        TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_one_active_plan ON workout_plans (client_id) WHERE is_active = TRUE;

CREATE TABLE workouts (
    workout_id       BIGSERIAL      PRIMARY KEY,
    workout_plan_id  BIGINT         NOT NULL REFERENCES workout_plans(workout_plan_id) ON DELETE CASCADE,
    scheduled_date   TIMESTAMPTZ    NOT NULL,
    status           workout_status NOT NULL DEFAULT 'planned',
    completed_at     TIMESTAMPTZ,
    duration_minutes INTEGER        CHECK (duration_minutes > 0)
);

CREATE TABLE exercises (
    exercise_id  BIGSERIAL    PRIMARY KEY,
    trainer_id   BIGINT       REFERENCES trainers(trainer_id) ON DELETE SET NULL,
    name         VARCHAR(100) NOT NULL,
    description  VARCHAR(255),
    muscle_group VARCHAR(100),
    video_url    VARCHAR(500)
);

CREATE TABLE workout_exercises (
    workout_exercise_id BIGSERIAL    PRIMARY KEY,
    workout_id          BIGINT       NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
    exercise_id         BIGINT       NOT NULL REFERENCES exercises(exercise_id),
    sets                INTEGER      NOT NULL CHECK (sets > 0),
    reps                INTEGER      NOT NULL CHECK (reps > 0),
    weight              NUMERIC(6,2) CHECK (weight >= 0),
    "order"             INTEGER      NOT NULL
);

CREATE TABLE workout_exercise_results (
    result_id           BIGSERIAL    PRIMARY KEY,
    workout_id          BIGINT       NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
    workout_exercise_id BIGINT       NOT NULL REFERENCES workout_exercises(workout_exercise_id),
    actual_sets         INTEGER      CHECK (actual_sets >= 0),
    actual_reps         INTEGER      CHECK (actual_reps >= 0),
    actual_weight       NUMERIC(6,2) CHECK (actual_weight >= 0),
    client_comment      VARCHAR(255),
    UNIQUE (workout_id, workout_exercise_id)
);

CREATE TABLE message_templates (
    message_template_id BIGSERIAL      PRIMARY KEY,
    user_id             BIGINT         REFERENCES users(user_id) ON DELETE CASCADE,
    text                VARCHAR(255)   NOT NULL,
    type                template_type  NOT NULL,
    scope               template_scope NOT NULL
);

CREATE TABLE notifications (
    notification_id BIGSERIAL         PRIMARY KEY,
    user_id         BIGINT            NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type            notification_type NOT NULL,
    text            VARCHAR(255)      NOT NULL,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    is_read         BOOLEAN           NOT NULL DEFAULT FALSE,
    sender_name     VARCHAR(200)
);
CREATE INDEX idx_notifications_user ON notifications (user_id, is_read);

CREATE TABLE food_logs (
    food_log_id BIGSERIAL PRIMARY KEY,
    client_id   BIGINT    NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
    date        DATE      NOT NULL,
    UNIQUE (client_id, date)
);

CREATE TABLE food_entries (
    food_entry_id BIGSERIAL    PRIMARY KEY,
    food_log_id   BIGINT       NOT NULL REFERENCES food_logs(food_log_id) ON DELETE CASCADE,
    title         VARCHAR(100) NOT NULL,
    description   VARCHAR(255),
    calories      INTEGER      CHECK (calories >= 0),
    protein       NUMERIC(5,2) CHECK (protein >= 0),
    fat           NUMERIC(5,2) CHECK (fat >= 0),
    carbs         NUMERIC(5,2) CHECK (carbs >= 0),
    meal_time     TIMESTAMPTZ
);
```

`notifications.sender_name` добавлена миграцией `002_notifications_sender_name` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

### Заметки по данным

- Все временны́е колонки — `TIMESTAMPTZ`; сервер нормализует входящие даты в UTC (`internal/types.FlexTime`).
- `exercises.trainer_id IS NULL` — системное упражнение.
- `exercises.video_url` хранит **ключ объекта S3** (`exercises/<id>.<ext>`), а не URL; в ответе API поле `video_url` — presigned-ссылка, сгенерированная сервисом.
- `message_templates.user_id IS NULL` + `scope = 'system'` — системный шаблон; шаблоны тренера создаются со `scope = 'trainer'`. Значение `client` в enum есть, но не используется.
- `trainers.invite_code` — 16 hex-символов (`crypto/rand`, 8 байт), генерируется при регистрации тренера.

---

## REST API

### Общие правила

- Префикс: `/api/v1`. Формат: JSON, конверт `{ "data": ..., "error": null }` / `{ "data": null, "error": "сообщение" }` (`internal/response`).
- Аутентификация: `Authorization: Bearer <jwt>`. Все маршруты, кроме `/auth/*`, за `middleware.Auth`.
- Статусы: 200, 201, 400, 401, 403, 404, 409, 500.
- Ошибки из сервисов маппятся в статус в `handleErr` / хендлерах каждого модуля.
- Даты в теле запроса: RFC3339, `2006-01-02T15:04:05` (считается UTC) или `2006-01-02`.

### Группы доступа

Определены в `backend/cmd/server/main.go`:

| Middleware | Роли |
|---|---|
| `adminMW` | `admin` |
| `trainerMW` | `trainer`, `admin` |
| `clientMW` | `client` |
| без role-middleware | любой аутентифицированный |

### Маршруты (53)

Роль в скобках — какой middleware стоит на маршруте. «any» — любой аутентифицированный пользователь.

#### Auth (публичные)
```
POST /auth/register            — регистрация (trainer | client); клиент обязан передать invite_code
POST /auth/login               — вход → { token }
```

#### Admin (admin)
```
GET    /admin/users            — список пользователей
GET    /admin/users/:id        — пользователь по ID
PATCH  /admin/users/:id        — { role?, is_active? }
DELETE /admin/users/:id        — удаление
GET    /admin/stats            — метрики, график активности, распределение целей, топ тренеров, последние регистрации
```

#### Trainer profile (trainer/admin)
```
GET   /trainers/me             — профиль тренера
PATCH /trainers/me             — { first_name?, last_name?, specialization? }
GET   /trainers/me/invite-code — { invite_code }
```

#### Clients
```
GET   /trainer/clients         — клиенты тренера (trainer/admin)
GET   /trainer/clients/:id     — клиент тренера (trainer/admin)
GET   /clients/me              — свой профиль, включая trainer_first_name / trainer_last_name (client)
PATCH /clients/me              — { first_name?, last_name?, goal?, weight?, height?, level?, health_notes?, date_of_birth? } (client)
```

#### Workout plans
```
POST   /trainer/clients/:clientId/plans      — создать (trainer/admin)
GET    /trainer/clients/:clientId/plans      — программы клиента (trainer/admin)
GET    /trainer/clients/:clientId/plans/:id  — одна программа (trainer/admin)
PATCH  /trainer/clients/:clientId/plans/:id  — { title?, description?, is_active?, end_date? } (trainer/admin)
DELETE /trainer/clients/:clientId/plans/:id  — удалить (trainer/admin)
GET    /clients/me/plans                     — активная программа клиента, 404 если нет (client)
```

#### Workouts
```
POST   /plans/:planId/workouts — создать { scheduled_date, duration_minutes? } (trainer/admin)
GET    /plans/:planId/workouts — тренировки программы (trainer/admin)
GET    /workouts/:id           — одна тренировка (any)
PATCH  /workouts/:id           — { scheduled_date?, duration_minutes? } (trainer/admin)
DELETE /workouts/:id           — удалить (trainer/admin)
POST   /workouts/:id/complete  — завершить; только из статуса planned (client)
GET    /clients/me/schedule    — все тренировки клиента (client)
```

#### Workout exercises & results
```
GET    /workouts/:workoutId/exercises              — упражнения тренировки (any)
POST   /workouts/:workoutId/exercises              — { exercise_id, sets, reps, weight?, order } (trainer/admin)
DELETE /workouts/:workoutId/exercises/:exerciseId  — :exerciseId = workout_exercise_id (trainer/admin)
POST   /workouts/:workoutId/results                — { results: [{ workout_exercise_id, actual_sets?, actual_reps?, actual_weight?, client_comment? }] }, upsert (client)
GET    /workouts/:workoutId/results                — фактические результаты (any)
```

#### Exercises
```
GET    /exercises              — тренер: системные + свои; admin: все (any)
GET    /exercises/:id          — одно упражнение (any)
POST   /exercises              — { name, description?, muscle_group? }; admin создаёт системное (trainer/admin)
PATCH  /exercises/:id          — свои — тренер, любые — admin (trainer/admin)
DELETE /exercises/:id          — свои — тренер, любые — admin (trainer/admin)
POST   /exercises/:id/video    — multipart, файл в S3 по ключу exercises/<id>.<ext> (trainer/admin)
```

#### Notifications (any, только свои)
```
GET    /notifications            — список, новые сверху
PATCH  /notifications/:id/read   — отметить прочитанным
POST   /notifications/read-all   — все прочитанные
DELETE /notifications/:id        — удалить одно
DELETE /notifications            — удалить все
```

#### Message templates (trainer/admin)
```
GET    /message-templates          — системные + свои
POST   /message-templates          — { text, type, scope? }; scope=system учитывается только для admin
DELETE /message-templates/:id      — свой; admin — любой
POST   /message-templates/:id/send — { client_user_id } → уведомление type=message получателю
```

#### Food log
```
GET    /clients/me/food-logs/:date          — журнал за дату YYYY-MM-DD (client)
POST   /clients/me/food-logs/:date/entries  — { title, description?, calories?, protein?, fat?, carbs?, meal_time? } (client)
PATCH  /clients/me/food-logs/entries/:id    — частичное обновление (client)
DELETE /clients/me/food-logs/entries/:id    — удалить (client)
GET    /trainer/clients/:id/food-logs/:date — журнал клиента, проверяется владение (trainer/admin)
```

#### Media (any)
```
POST /media/upload  — multipart, файл в S3 по ключу uploads/<uuid>.<ext> → { key }
```

---

## Безопасность

### JWT
- Payload: `{ user_id, role, exp }`, HS256, секрет `JWT_SECRET`, срок `JWT_EXPIRE_HOURS` (по умолчанию 24).
- Refresh-токенов нет. После истечения — 401, фронт разлогинивает.

### Пароли
- bcrypt, cost 12. Хеш никогда не возвращается в ответах.
- Вход заблокированного (`is_active = FALSE`) пользователя отклоняется как неверные учётные данные.

### RBAC (как реализовано)

| Действие | Клиент | Тренер | Админ |
|---|:---:|:---:|:---:|
| Регистрация | ✓ | ✓ | — (только seed) |
| Свой профиль | ✓ | ✓ | — |
| Своя активная программа и расписание | ✓ | — | — |
| CRUD программ и тренировок своих клиентов | — | ✓ | см. расхождения |
| Фиксация результатов, завершение тренировки | ✓ | — | — |
| Дневник питания (ведение) | ✓ | — | — |
| Дневник питания клиента (просмотр) | — | ✓ | см. расхождения |
| Свои упражнения | — | ✓ | ✓ (все) |
| Системные упражнения | — | — | ✓ |
| Шаблоны сообщений | — | ✓ (свои) | ✓ (системные) |
| Пользователи, роли, блокировка, статистика | — | — | ✓ |

---

## Бизнес-логика

### Регистрация
1. Роль — только `trainer` или `client`. Email: `TrimSpace` + `ToLower`, проверка уникальности (409 при занятости).
2. Тренер: в транзакции `users` → `trainers` с новым `invite_code`.
3. Клиент: по `invite_code` находится тренер (иначе ошибка), затем в транзакции `users` → `clients`.
4. Администратор создаётся только `go run ./cmd/seed` (env `ADMIN_EMAIL`, `ADMIN_PASSWORD`).

### Активная программа
- Не более одной активной программы на клиента: частичный уникальный индекс `idx_one_active_plan`.
- При создании программы с `is_active = true` сервис сначала деактивирует текущую активную.

### Назначение тренировки
- `POST /plans/:planId/workouts` в одной транзакции создаёт тренировку и уведомление клиенту `workout_assigned` с `sender_name` = ФИО тренера.

### Выполнение тренировки (клиент)
1. Клиент открывает тренировку в статусе `planned` (`/workout/:id`).
2. Вводит фактические подходы, повторения, вес и комментарий по каждому упражнению.
3. «Завершить тренировку» — фронт делает **два последовательных запроса**: сначала `POST /workouts/:id/results`, затем `POST /workouts/:id/complete`.
4. `complete` в одной транзакции: `status = 'completed'`, `completed_at = NOW()`, уведомление тренеру `workout_completed` с ФИО клиента в `text` и `sender_name`.

### Уведомления
- `workout_assigned` — при создании тренировки → клиенту.
- `workout_completed` — при завершении → тренеру.
- `message` — `POST /message-templates/:id/send` → получателю `client_user_id` (без `sender_name`).
- Фронт опрашивает `GET /notifications` каждые 10 секунд (`AppShell`) и хранит счётчик непрочитанных в Zustand.

### Видео упражнений
- Загружается `POST /exercises/:id/video` (multipart, лимит тела Fiber 200 МБ).
- В БД — ключ объекта; при выдаче упражнения сервис генерирует presigned GET URL с TTL `S3_PRESIGN_TTL_SECONDS` (по умолчанию 3600).
- Бакет создаётся при старте сервера, если его нет.

---

## Фронтенд

### Стек и устройство
- React 18 + TypeScript (strict) + Vite 6, алиас `@/` → `src/`.
- React Router v6, TanStack Query v5 (`staleTime` 30 с, `retry` 1), Zustand v5, Axios.
- Tailwind CSS 3 (токены в `tailwind.config.js`), lucide-react (иконки), recharts (графики).
- Токен, роль, user_id, displayName хранятся в Zustand `persist` (`localStorage`, ключ `fittrack-auth`).
- Axios-интерцептор добавляет `Bearer`, на 401 вызывает `logout()`, чистит кеш Query и уводит на `/login`.
- API-слой: `src/api/index.ts`, объекты `authApi`, `clientApi`, `trainerApi`, `planApi`, `workoutApi`, `workoutExerciseApi`, `exerciseApi`, `foodApi`, `notificationApi`, `templateApi`, `adminApi`, `statsApi`; `unwrap()` разворачивает конверт.
- Маршрутизация: `PrivateRoute` (проверка токена) → `AppShell` (Header всегда, пункты навигации в нём от `lg`; ниже `lg` — BottomNav) → `RoleRoute allow={[...]}`. Неизвестный путь → домашняя страница роли или `/login`.

### Навигация по ролям (`src/lib/nav.ts`)

| Роль | Пункты | Домашняя |
|---|---|---|
| Клиент | Личный кабинет `/profile` · Расписание `/schedule` · Прогресс `/progress` · Дневник питания `/food-diary` · Уведомления `/notifications` (badge) | `/profile` |
| Тренер | Профиль `/trainer/profile` · Клиенты `/trainer/clients` · Упражнения `/trainer/exercises` · Шаблоны `/trainer/templates` · Уведомления `/trainer/notifications` (badge) | `/trainer/profile` |
| Админ | Статистика `/admin/stats` · Пользователи `/admin/users` · Упражнения `/admin/exercises` · Шаблоны `/admin/templates` | `/admin/users` |

Выход — в Header.

### Экраны (`src/App.tsx`)

| Путь | Роль | Компонент | Содержание |
|---|---|---|---|
| `/login` | — | `auth/Login` | Email, пароль → редирект на домашнюю роли |
| `/register` | — | `auth/Register` | Email, имя, фамилия, пароль, роль (Клиент/Тренер); код приглашения только для клиента; после успеха → `/login` |
| `/profile` | client | `client/Profile` | Имя, фамилия, дата рождения, цель, вес, рост, уровень, ограничения по здоровью; баннер «Ваш тренер» |
| `/schedule` | client | `client/Schedule` | Карточки тренировок по датам: дата/время, статус (цвет), длительность, программа; `planned` → экран выполнения |
| `/workout/:id` | client | `client/WorkoutExecution` | Упражнения: название, описание, видео, план; инпуты факта и комментарий; «Завершить тренировку» |
| `/progress` | client | `client/Progress` | Статистика и графики по данным расписания |
| `/food-diary` | client | `client/FoodDiary` | Выбор даты, приёмы пищи (название, описание, ккал, Б/Ж/У, время), форма добавления, итог за день |
| `/notifications` | client | `shared/Notifications` | Список, иконка и цвет по типу, отправитель, «прочитать все», удаление |
| `/trainer/profile` | trainer | `trainer/Profile` | Профиль тренера, код приглашения |
| `/trainer/clients` | trainer | `trainer/ClientList` | ФИО, цель, уровень, активная программа, «Открыть»; копирование кода приглашения |
| `/trainer/clients/:id` | trainer | `trainer/ClientDetail` | Вкладки: Профиль, Программа, Результаты, Питание |
| `/trainer/clients/:id/plans/:planId` | trainer | `trainer/ProgramEdit` | Название, описание, дата окончания, активность; список тренировок |
| `/trainer/plans/:planId/workouts/new` | trainer | `trainer/WorkoutForm` | Создание тренировки |
| `/trainer/workouts/:id/edit` | trainer | `trainer/WorkoutForm` | Дата, длительность, упражнения (подходы, повторения, вес, порядок) |
| `/trainer/exercises` | trainer | `shared/Exercises` | Свои + системные упражнения, создание, загрузка видео |
| `/trainer/templates` | trainer | `shared/Templates` | Шаблоны с фильтром по типу, отправка клиенту |
| `/trainer/notifications` | trainer | `shared/Notifications` | Как у клиента |
| `/admin/stats` | admin | `admin/Stats` | Метрики, график активности, распределение целей, топ тренеров, последние регистрации |
| `/admin/users` | admin | `admin/Users` | Таблица пользователей, счётчики, фильтры (все/тренеры/клиенты/заблокированные), поиск по имени и email, смена роли, блокировка, удаление |
| `/admin/exercises` | admin | `shared/Exercises system` | Системные упражнения |
| `/admin/templates` | admin | `shared/Templates system` | Системные шаблоны |

---

## Визуальный дизайн

Токены заданы в `frontend/tailwind.config.js` и продублированы CSS-переменными в `frontend/src/index.css`.

| Назначение | HEX | Tailwind | CSS-переменная |
|---|---|---|---|
| Основной | `#1E40AF` | `primary` | `--color-primary` |
| Успех | `#10B981` | `success` | `--color-success` |
| Фон страниц | `#F8FAFC` | `page` | `--color-bg-page` |
| Фон карточек | `#FFFFFF` | `card` | `--color-bg-card` |
| Основной текст | `#0F172A` | `ink` | `--color-text-main` |
| Вспомогательный текст | `#64748B` | `muted` | `--color-text-muted` |
| Ошибки | `#DC2626` | `danger` | `--color-error` |
| Предупреждения | `#F59E0B` | `warn` | `--color-warning` |
| Информация | `#3B82F6` | `info` | `--color-info` |
| Границы | `#E2E8F0` | `line` | `--color-border` |

- Шрифт Manrope (Google Fonts), H1 24px/700, H2 20px/600, H3 18px/600, текст 16px/400.
- Радиусы: карточки 12px (`rounded-card`), кнопки и инпуты 8px (`rounded-btn`, `rounded-input`).
- Тень карточек: `shadow-card`. Максимальная ширина контента: `max-w-content` (1200px).
- Адаптив: брейкпоинт навигации `lg` (1024px) — выше пункты в Header, ниже BottomNav.

---

## Окружение

### Переменные (`.env.example`)

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `DATABASE_URL` | обязательна | `postgres://user:password@localhost:5433/fittrack?sslmode=disable` |
| `JWT_SECRET` | обязательна | Подпись JWT |
| `JWT_EXPIRE_HOURS` | 24 | Срок токена |
| `PORT` | 8080 | Порт API |
| `S3_ENDPOINT` | `http://localhost:9000` | MinIO |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `minioadmin` | Доступ к MinIO |
| `S3_BUCKET` | `fittrack-media` | Бакет |
| `S3_REGION` | `us-east-1` | Регион |
| `S3_PRESIGN_TTL_SECONDS` | 3600 | TTL presigned URL |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | Только для `cmd/seed` |
| `VITE_API_BASE_URL` | `http://localhost:8080/api/v1` | База API для фронта (в Docker задаётся на этапе сборки) |

Бэкенд читает `.env` через godotenv из текущего каталога запуска.

### Docker Compose

| Сервис | Порт хоста | Примечание |
|---|---|---|
| `postgres` | 5433 → 5432 | `postgres:16-alpine`, healthcheck `pg_isready` |
| `minio` | 9000, 9001 (консоль) | |
| `backend` | 8080 | `env_file: .env`, ждёт healthy postgres |
| `frontend` | 5173 → 80 | Статическая сборка через nginx со SPA-fallback |

---

## Сценарий проверки (минимальный)

1. `make infra` → `make seed` — создан администратор.
2. Тренер регистрируется сам и получает `invite_code`.
3. Клиент регистрируется с `invite_code`.
4. Тренер создаёт активную программу для клиента.
5. Тренер добавляет тренировку с упражнениями → клиент получает `workout_assigned`.
6. Клиент открывает тренировку, вводит результаты, нажимает «Завершить» → тренер получает `workout_completed`.
7. Тренер смотрит результаты на вкладке «Результаты» и при необходимости правит программу.

Автоматизировано: `backend/e2e_test.py` (HTTP-смоук по API) и Playwright-набор `frontend/tests/e2e`.

---

## Известные расхождения с исходным ТЗ

| ТЗ | Как в коде |
|---|---|
| Временные метки `TIMESTAMP WITHOUT TIME ZONE` | `TIMESTAMPTZ` |
| Миграции через golang-migrate | Свой раннер на `go:embed` + `schema_migrations` |
| Маршруты клиента `/client/profile`, `/client/schedule`, `/client/workout/:id` и т.д. | Без префикса: `/profile`, `/schedule`, `/workout/:id`, `/progress`, `/food-diary` |
| Уведомления по общему `/notifications` | Клиент — `/notifications`, тренер — `/trainer/notifications`; у админа уведомлений нет |
| Навигация админа: Пользователи, Системные упражнения, Системные шаблоны | Добавлена «Статистика» (`/admin/stats`), подписи «Упражнения», «Шаблоны» |
| Завершение: `complete`, затем `results`, одна транзакция с результатами | Сначала `results`, затем `complete`; это два независимых запроса |
| Администратор создаёт тренера | Тренер регистрируется сам; админ только seed'ом |
| `/media/upload` возвращает URL | Возвращает `{ key }`; фронт этот эндпоинт не использует |
| `video_url` хранит ссылку | Хранит ключ объекта, ссылка генерируется при выдаче |
| Админ может создавать и редактировать программы и тренировки | `trainerMW` пропускает admin, но сервисы ищут `trainers.trainer_id` по `user_id`; у админа такой записи нет, запрос завершается ошибкой. Во фронте у админа этих экранов нет |
| Только перечисленные в ТЗ маршруты | Добавлены `GET /admin/stats`, `GET /exercises/:id`, `GET /workouts/:workoutId/exercises`, `POST /message-templates/:id/send`, `DELETE /notifications`, `DELETE /notifications/:id` |
| Колонки `notifications` по ТЗ | Добавлена `sender_name` (миграция 002) |

## Известные проблемы

Найдены при чтении кода, не исправлены:

- `POST /workouts/:workoutId/results` не проверяет, что тренировка принадлежит текущему клиенту.
- `GET /workouts/:id`, `GET /workouts/:workoutId/exercises`, `GET /workouts/:workoutId/results`, `GET /exercises/:id` доступны любому аутентифицированному пользователю без проверки владения.
- `POST /message-templates/:id/send` не проверяет ни принадлежность шаблона отправителю, ни то, что `client_user_id` — клиент этого тренера.
- `middleware.Auth` не проверяет `is_active`: заблокированный пользователь работает со старым токеном до его истечения.
- `PATCH /admin/users/:id` меняет только `users.role`; записи `trainers`/`clients` под новую роль не создаются.
- Результаты и завершение — два запроса без общей транзакции: при сбое второго результаты сохранятся, а статус останется `planned`.
- Открытые баги e2e — `frontend/tests/bugs.md`.
