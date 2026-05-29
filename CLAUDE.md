# FitTrack — Веб-приложение для подбора персональных фитнес-занятий

## Обзор проекта

Многопользовательская веб-платформа для централизованного ведения клиентов фитнес-тренером. Система обеспечивает персонализированный подход к организации тренировок, автоматизацию сопровождения клиентов и структурированное взаимодействие между тренером и клиентом в рамках единого цифрового пространства.

**Роли пользователей:** Клиент · Тренер · Администратор  
**Архитектура:** REST API, клиент-сервер  
**Аутентификация:** JWT + bcrypt + RBAC

---

## Технологический стек

### Frontend
- **React 18** + **TypeScript**
- **React Router v6** — маршрутизация
- **Zustand** — управление глобальным состоянием
- **React Query (TanStack Query)** — кеширование и синхронизация серверных данных
- **Axios** — HTTP-клиент
- **Vite** — сборщик

### Backend
- **Go** (Golang) + **Fiber** (веб-фреймворк)
- **pgx/v5** — PostgreSQL-драйвер (нативный протокол, пул соединений)
- **golang-jwt/jwt** — JWT-токены
- **golang.org/x/crypto/bcrypt** — хеширование паролей
- **aws-sdk-go-v2** — взаимодействие с S3-совместимым хранилищем

### База данных
- **PostgreSQL 16** — основная СУБД
- Миграции: **golang-migrate** или SQL-файлы вручную

### Объектное хранилище
- **MinIO** (self-hosted) или **Yandex Object Storage / Selectel** — видеопревью упражнений и аватары пользователей
- Доступ через временные подписанные ссылки (presigned URLs)

### Инфраструктура
- Docker + Docker Compose
- Передача данных: HTTPS

---

## Структура проекта

```
fittrack/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── config/
│   │   ├── middleware/        # JWT auth, RBAC, logger
│   │   ├── modules/
│   │   │   ├── auth/          # handlers, service, repository
│   │   │   ├── users/
│   │   │   ├── trainers/
│   │   │   ├── clients/
│   │   │   ├── workout_plans/
│   │   │   ├── workouts/
│   │   │   ├── exercises/
│   │   │   ├── workout_results/
│   │   │   ├── notifications/
│   │   │   ├── message_templates/
│   │   │   ├── food_log/
│   │   │   └── media/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   └── postgres.go
│   │   └── storage/           # S3-клиент
│   ├── go.mod
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/               # axios-инстанс, API-функции по модулям
│   │   ├── components/        # переиспользуемые UI-компоненты
│   │   │   ├── ui/            # Button, Input, Card, Badge, Modal, etc.
│   │   │   └── layout/        # Header, PageWrapper
│   │   ├── pages/
│   │   │   ├── auth/          # Login, Register
│   │   │   ├── client/        # Profile, Schedule, WorkoutExecution, Progress, FoodDiary, Notifications
│   │   │   ├── trainer/       # Profile, ClientList, ClientDetail, ProgramEdit, WorkoutForm, Exercises, Templates
│   │   │   └── admin/         # Users, SystemExercises, SystemTemplates
│   │   ├── store/             # Zustand stores (auth, notifications)
│   │   ├── hooks/             # кастомные хуки
│   │   ├── types/             # TypeScript-типы
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## База данных

### ENUM-типы (создать до таблиц)

```sql
CREATE TYPE user_role AS ENUM ('admin', 'trainer', 'client');
CREATE TYPE fitness_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE workout_status AS ENUM ('planned', 'completed', 'skipped');
CREATE TYPE template_scope AS ENUM ('system', 'trainer', 'client');
CREATE TYPE template_type AS ENUM ('confirmation', 'reschedule', 'feedback');
CREATE TYPE notification_type AS ENUM ('workout_assigned', 'workout_completed', 'message');
```

### Таблицы

#### `users` — учётные записи

```sql
CREATE TABLE users (
  user_id       BIGSERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,   -- приводить к нижнему регистру
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,           -- bcrypt
  role          user_role    NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX idx_users_email ON users (LOWER(email));
```

#### `trainers` — профили тренеров

```sql
CREATE TABLE trainers (
  trainer_id     BIGSERIAL PRIMARY KEY,
  user_id        BIGINT       NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  specialization VARCHAR(255),
  invite_code    VARCHAR(20)  NOT NULL UNIQUE   -- уникальный код приглашения
);
```

#### `clients` — профили клиентов

```sql
CREATE TABLE clients (
  client_id     BIGSERIAL PRIMARY KEY,
  user_id       BIGINT        NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  trainer_id    BIGINT        NOT NULL REFERENCES trainers(trainer_id),
  goal          VARCHAR(255),
  weight        NUMERIC(5,2)  CHECK (weight > 0),
  height        NUMERIC(5,2)  CHECK (height > 0),
  level         fitness_level,
  health_notes  VARCHAR(255),
  date_of_birth DATE
);
```

#### `workout_plans` — тренировочные программы

```sql
CREATE TABLE workout_plans (
  workout_plan_id BIGSERIAL PRIMARY KEY,
  client_id       BIGINT       NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
  title           VARCHAR(100) NOT NULL,
  description     VARCHAR(255),
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  end_date        TIMESTAMP
);
-- Только одна активная программа на клиента
CREATE UNIQUE INDEX idx_one_active_plan ON workout_plans (client_id) WHERE is_active = TRUE;
```

#### `workouts` — тренировки

```sql
CREATE TABLE workouts (
  workout_id       BIGSERIAL PRIMARY KEY,
  workout_plan_id  BIGINT         NOT NULL REFERENCES workout_plans(workout_plan_id) ON DELETE CASCADE,
  scheduled_date   TIMESTAMP      NOT NULL,
  status           workout_status NOT NULL DEFAULT 'planned',
  completed_at     TIMESTAMP,
  duration_minutes INTEGER        CHECK (duration_minutes > 0)
);
```

#### `exercises` — справочник упражнений

```sql
CREATE TABLE exercises (
  exercise_id  BIGSERIAL PRIMARY KEY,
  trainer_id   BIGINT       REFERENCES trainers(trainer_id) ON DELETE SET NULL,  -- NULL = системное
  name         VARCHAR(100) NOT NULL,
  description  VARCHAR(255),
  muscle_group VARCHAR(100),
  video_url    VARCHAR(500)  -- presigned S3 URL
);
```

#### `workout_exercises` — упражнения в тренировке (плановые параметры)

```sql
CREATE TABLE workout_exercises (
  workout_exercise_id BIGSERIAL PRIMARY KEY,
  workout_id          BIGINT         NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
  exercise_id         BIGINT         NOT NULL REFERENCES exercises(exercise_id),
  sets                INTEGER        NOT NULL CHECK (sets > 0),
  reps                INTEGER        NOT NULL CHECK (reps > 0),
  weight              NUMERIC(6,2)   CHECK (weight >= 0),
  "order"             INTEGER        NOT NULL
);
```

#### `workout_exercise_results` — фактические результаты

```sql
CREATE TABLE workout_exercise_results (
  result_id           BIGSERIAL PRIMARY KEY,
  workout_id          BIGINT       NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
  workout_exercise_id BIGINT       NOT NULL REFERENCES workout_exercises(workout_exercise_id),
  actual_sets         INTEGER      CHECK (actual_sets >= 0),
  actual_reps         INTEGER      CHECK (actual_reps >= 0),
  actual_weight       NUMERIC(6,2) CHECK (actual_weight >= 0),
  client_comment      VARCHAR(255),
  UNIQUE (workout_id, workout_exercise_id)
);
```

#### `message_templates` — шаблоны сообщений

```sql
CREATE TABLE message_templates (
  message_template_id BIGSERIAL PRIMARY KEY,
  user_id             BIGINT          REFERENCES users(user_id) ON DELETE CASCADE,  -- NULL = системный
  text                VARCHAR(255)    NOT NULL,
  type                template_type   NOT NULL,
  scope               template_scope  NOT NULL
);
```

#### `notifications` — уведомления

```sql
CREATE TABLE notifications (
  notification_id BIGSERIAL PRIMARY KEY,
  user_id         BIGINT            NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type            notification_type NOT NULL,
  text            VARCHAR(255)      NOT NULL,
  created_at      TIMESTAMP         NOT NULL DEFAULT NOW(),
  is_read         BOOLEAN           NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_notifications_user ON notifications (user_id, is_read);
```

#### `food_logs` — журнал питания (по дням)

```sql
CREATE TABLE food_logs (
  food_log_id BIGSERIAL PRIMARY KEY,
  client_id   BIGINT NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
  date        DATE   NOT NULL,
  UNIQUE (client_id, date)
);
```

#### `food_entries` — приёмы пищи

```sql
CREATE TABLE food_entries (
  food_entry_id BIGSERIAL PRIMARY KEY,
  food_log_id   BIGINT       NOT NULL REFERENCES food_logs(food_log_id) ON DELETE CASCADE,
  title         VARCHAR(100) NOT NULL,
  description   VARCHAR(255),
  calories      INTEGER      CHECK (calories >= 0),
  protein       NUMERIC(5,2) CHECK (protein >= 0),
  fat           NUMERIC(5,2) CHECK (fat >= 0),
  carbs         NUMERIC(5,2) CHECK (carbs >= 0),
  meal_time     TIMESTAMP
);
```

---

## REST API

### Общие правила

- Базовый префикс: `/api/v1`
- Аутентификация: `Authorization: Bearer <jwt_token>`
- Формат данных: JSON
- Ответы: `{ "data": ..., "error": null }` или `{ "data": null, "error": "сообщение" }`
- HTTP-статусы: 200, 201, 400, 401, 403, 404, 409, 500

### Маршруты

#### Auth (публичные)
```
POST /auth/register      — регистрация
POST /auth/login         — вход, возвращает JWT
```

#### Users (admin)
```
GET    /admin/users              — список всех пользователей
GET    /admin/users/:id          — пользователь по ID
PATCH  /admin/users/:id          — изменение роли / статуса активности
DELETE /admin/users/:id          — удаление
```

#### Trainer profile
```
GET   /trainers/me               — профиль тренера
PATCH /trainers/me               — обновление профиля
GET   /trainers/me/invite-code   — получить код приглашения
```

#### Clients
```
GET   /trainer/clients           — список клиентов тренера
GET   /trainer/clients/:id       — данные клиента
GET   /clients/me                — профиль клиента (для клиента)
PATCH /clients/me                — редактирование профиля клиента
```

#### Workout Plans
```
POST   /trainer/clients/:clientId/plans       — создать программу
GET    /trainer/clients/:clientId/plans       — программы клиента
GET    /trainer/clients/:clientId/plans/:id   — одна программа
PATCH  /trainer/clients/:clientId/plans/:id   — редактировать
DELETE /trainer/clients/:clientId/plans/:id   — удалить
GET    /clients/me/plans                      — активная программа клиента
```

#### Workouts
```
POST   /plans/:planId/workouts           — создать тренировку
GET    /plans/:planId/workouts           — список тренировок программы
GET    /workouts/:id                     — одна тренировка
PATCH  /workouts/:id                     — редактировать (тренер)
DELETE /workouts/:id                     — удалить (тренер)
POST   /workouts/:id/complete            — отметить выполненной (клиент)
GET    /clients/me/schedule              — расписание клиента
```

#### Workout Exercises & Results
```
POST   /workouts/:workoutId/exercises              — добавить упражнение в тренировку
DELETE /workouts/:workoutId/exercises/:exerciseId  — удалить
POST   /workouts/:workoutId/results                — сохранить результаты (клиент)
GET    /workouts/:workoutId/results                — результаты тренировки
```

#### Exercises
```
GET    /exercises                   — справочник (системные + свои тренера)
POST   /exercises                   — создать упражнение (тренер / admin)
PATCH  /exercises/:id               — редактировать
DELETE /exercises/:id               — удалить
POST   /exercises/:id/video         — загрузить видео (multipart)
```

#### Notifications
```
GET    /notifications               — уведомления текущего пользователя
PATCH  /notifications/:id/read      — отметить прочитанным
POST   /notifications/read-all      — все как прочитанные
```

#### Message Templates
```
GET    /message-templates           — шаблоны по роли и scope
POST   /message-templates           — создать (тренер / admin)
DELETE /message-templates/:id       — удалить
```

#### Food Log
```
GET    /clients/me/food-logs/:date           — журнал за дату
POST   /clients/me/food-logs/:date/entries   — добавить запись
PATCH  /clients/me/food-logs/entries/:id     — редактировать
DELETE /clients/me/food-logs/entries/:id     — удалить
GET    /trainer/clients/:id/food-logs/:date  — журнал клиента (тренер)
```

#### Media
```
POST /media/upload     — загрузка файла → возвращает URL
```

---

## Безопасность

### JWT
- Payload: `{ user_id, role, exp }`
- Access token: 24 часа
- Подпись: HS256, секрет из env `JWT_SECRET`
- Middleware проверяет токен на каждый защищённый маршрут

### RBAC — матрица доступа

| Действие | Клиент | Тренер | Администратор |
|---|:---:|:---:|:---:|
| Регистрация и авторизация | ✓ | ✓ | ✓ |
| Редактирование своего профиля | ✓ | ✓ | ✓ |
| Просмотр назначенной программы | ✓ | ✓ | ✓ |
| Создание/редактирование программ | — | ✓ | ✓ |
| Назначение тренировок клиентам | — | ✓ | ✓ |
| Фиксация результатов упражнений | ✓ | — | — |
| Просмотр прогресса клиентов | — | ✓ | ✓ |
| Ведение дневника питания | ✓ | — | — |
| Просмотр дневника питания клиентов | — | ✓ | ✓ |
| Управление пользовательскими упражнениями | — | ✓ | ✓ |
| Управление системными упражнениями | — | — | ✓ |
| Управление учётными записями | — | — | ✓ |
| Назначение и изменение ролей | — | — | ✓ |

### Пароли
- Хеширование: `bcrypt`, cost 12
- Пароль никогда не возвращается в API-ответах

---

## Бизнес-логика (ключевые правила)

### Регистрация клиента
1. Клиент указывает `invite_code` тренера при регистрации
2. Система находит тренера по коду → создаёт запись в `clients` с `trainer_id`
3. Email приводится к нижнему регистру и проверяется на уникальность

### Активная программа
- На одного клиента — не более одной активной программы (`is_active = TRUE`)
- Уникальный частичный индекс на уровне БД: `UNIQUE (client_id) WHERE is_active = TRUE`
- При создании новой активной программы нужно деактивировать предыдущую

### Выполнение тренировки (клиент)
1. Клиент открывает тренировку в статусе `planned`
2. Вводит фактические значения по каждому упражнению (`actual_sets`, `actual_reps`, `actual_weight`, опционально `client_comment`)
3. Нажимает «Завершить тренировку» → статус меняется на `completed`, фиксируется `completed_at`
4. Автоматически создаётся уведомление тренеру типа `workout_completed`

### Уведомления
- `workout_assigned` — создаётся тренером при назначении тренировки → получатель: клиент
- `workout_completed` — создаётся клиентом при завершении → получатель: тренер
- `message` — создаётся при использовании шаблона сообщения

### Видео упражнений
- Загружается в S3-хранилище тренером или администратором
- В БД хранится постоянная ссылка или ключ объекта
- При выдаче клиенту сервер генерирует временную подписанную ссылку (TTL 1 час)

---

## Визуальный дизайн

### Цветовая схема

| Назначение | HEX | Применение |
|---|---|---|
| **Основной (Primary)** | `#1E40AF` | Кнопки, активные элементы, индикаторы навигации |
| **Акцентный (Success)** | `#10B981` | Успешные операции, завершённые тренировки |
| **Фон страниц** | `#F8FAFC` | Светлый нейтральный фон |
| **Фон карточек** | `#FFFFFF` | Карточки, формы |
| **Основной текст** | `#0F172A` | Весь текстовый контент (контраст ≥ 7:1) |
| **Ошибки** | `#DC2626` | Сообщения об ошибках, критические предупреждения |
| **Предупреждения** | `#F59E0B` | Предупреждения общего характера |
| **Информация** | `#3B82F6` | Информационные сообщения, ссылки |
| **Граница / разделитель** | `#E2E8F0` | Границы карточек, строки таблиц |
| **Вспомогательный текст** | `#64748B` | Подписи, метки, placeholder |

CSS-переменные:
```css
:root {
  --color-primary:     #1E40AF;
  --color-success:     #10B981;
  --color-bg-page:     #F8FAFC;
  --color-bg-card:     #FFFFFF;
  --color-text-main:   #0F172A;
  --color-text-muted:  #64748B;
  --color-error:       #DC2626;
  --color-warning:     #F59E0B;
  --color-info:        #3B82F6;
  --color-border:      #E2E8F0;
}
```

### Типографика — Manrope (Google Fonts)

Подключение: `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');`

| Элемент | Размер | Начертание | Font-weight |
|---|---|---|---|
| H1 — заголовок страницы | 24px | Полужирный | 700 |
| H2 — заголовок секции | 20px | Полужирный | 600 |
| H3 — подзаголовок | 18px | Полужирный | 600 |
| Основной текст | 16px | Обычный | 400 |
| Вспомогательный текст | 14px | Обычный | 400 |
| Подписи и метки | 12px | Обычный | 400 |

```css
body {
  font-family: 'Manrope', sans-serif;
  font-size: 16px;
  font-weight: 400;
  color: var(--color-text-main);
  background-color: var(--color-bg-page);
}
```

### Прочие параметры дизайна

- **Border-radius карточек:** 12px
- **Border-radius кнопок:** 8px
- **Border-radius инпутов:** 8px
- **Тень карточек:** `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`
- **Отступ внутри карточек (padding):** 24px
- **Gap между карточками:** 16px
- **Максимальная ширина контентной области:** 1200px, центрирована

---

## Структура пользовательского интерфейса

### Навигационный Header

Присутствует на всех страницах авторизованного пользователя. Состав пунктов зависит от роли.

**Клиент:**  
`Личный кабинет` · `Расписание` · `Прогресс` · `Дневник питания` · `Уведомления (badge)` · `Выйти`

**Тренер:**  
`Профиль` · `Клиенты` · `Упражнения` · `Шаблоны сообщений` · `Уведомления (badge)` · `Выйти`

**Администратор:**  
`Пользователи` · `Системные упражнения` · `Системные шаблоны` · `Выйти`

---

### Экраны приложения

#### 1. Регистрация (`/register`)
Доступна без авторизации.  
Поля формы:
- Email → `users.email`
- Имя → `users.first_name`
- Фамилия → `users.last_name`
- Пароль → `users.password_hash`
- Роль (выпадающий список: Клиент / Тренер) → `users.role`
- Код приглашения (только для роли «Клиент») → `trainers.invite_code`

**UX:** Поле «Код приглашения» появляется только при выборе роли «Клиент». После успешной регистрации — редирект на `/login`.

---

#### 2. Вход (`/login`)
Поля: Email, Пароль.  
После успешного входа — редирект на главную страницу роли.

---

#### 3. Профиль клиента (`/client/profile`)
Карточка с отображением и редактированием данных.  
Поля:
- Имя / Фамилия → `users`
- Дата рождения → `clients.date_of_birth`
- Цель тренировок → `clients.goal`
- Вес (кг) → `clients.weight`
- Рост (см) → `clients.height`
- Уровень подготовки (beginner / intermediate / advanced) → `clients.level`
- Ограничения по здоровью → `clients.health_notes`

---

#### 4. Расписание клиента (`/client/schedule`)
Список карточек тренировок, сгруппированных по дате.  
Данные карточки:
- Дата и время → `workouts.scheduled_date`
- Статус (planned / completed / skipped) → `workouts.status` (цветовая индикация)
- Длительность → `workouts.duration_minutes`
- Название программы → `workout_plans.title`

Нажатие на карточку со статусом `planned` → переход на экран выполнения тренировки.

---

#### 5. Выполнение тренировки (`/client/workout/:id`)
Ключевой экран клиента.  
Отображает перечень упражнений:
- Название упражнения → `exercises.name`
- Описание → `exercises.description`
- Видеопревью (если есть) → `exercises.video_url` (presigned URL)
- Плановые подходы / повторения / вес → `workout_exercises.sets/reps/weight`
- Инпуты: фактические подходы / повторения / вес → `workout_exercise_results`
- Текстовое поле для комментария → `workout_exercise_results.client_comment`

Кнопка «Завершить тренировку» → вызов `POST /workouts/:id/complete`, затем `POST /workouts/:id/results`.

---

#### 6. Прогресс клиента (`/client/progress`)
Графики и таблицы истории тренировок:
- График выполненных тренировок по дням/неделям
- Динамика веса по упражнениям
- Статистика: всего тренировок, завершено, пропущено

---

#### 7. Дневник питания (`/client/food-diary`)
Выбор даты + список приёмов пищи за день.  
Карточка записи: название, описание, ккал, Б/Ж/У, время приёма.  
Форма добавления записи:
- Название блюда → `food_entries.title`
- Описание → `food_entries.description`
- Калорийность (ккал) → `food_entries.calories`
- Белки (г) → `food_entries.protein`
- Жиры (г) → `food_entries.fat`
- Углеводы (г) → `food_entries.carbs`
- Время приёма пищи → `food_entries.meal_time`

Итоговая строка за день: суммарные ккал и БЖУ.

---

#### 8. Уведомления (`/notifications`)
Список уведомлений с делением на прочитанные/непрочитанные.  
Тип уведомления отображается иконкой и цветом.  
Кнопка «Отметить все прочитанными».

---

#### 9. Список клиентов тренера (`/trainer/clients`)
Таблица или сетка карточек:
- ФИО клиента → `users`
- Цель тренировок → `clients.goal`
- Уровень подготовки → `clients.level`
- Название активной программы → `workout_plans.title` (если есть)
- Кнопка «Открыть»

Кнопка «Скопировать код приглашения» в шапке страницы.

---

#### 10. Карточка клиента тренера (`/trainer/clients/:id`)
Вкладки:
- **Профиль** — персональные данные клиента (только просмотр)
- **Программа** — активная программа с перечнем тренировок; кнопки создания/редактирования
- **Результаты** — история выполненных тренировок и фактические показатели
- **Питание** — дневник питания клиента (только просмотр)

---

#### 11. Редактирование тренировочной программы (`/trainer/clients/:id/plans/:planId`)
Форма программы:
- Название → `workout_plans.title`
- Описание → `workout_plans.description`
- Дата окончания → `workout_plans.end_date`
- Статус активности → `workout_plans.is_active`

Список тренировок программы: каждая тренировка — строка с датой, статусом и кнопками.

---

#### 12. Формирование/редактирование тренировки (`/trainer/workouts/:id/edit`)
Форма тренировки:
- Дата проведения → `workouts.scheduled_date`
- Длительность (мин) → `workouts.duration_minutes`

Список упражнений (drag-and-drop порядок):
- Выбор упражнения из справочника
- Подходы → `workout_exercises.sets`
- Повторения → `workout_exercises.reps`
- Рабочий вес → `workout_exercises.weight`
- Порядок → `workout_exercises.order` (авто при перетаскивании)

Кнопка «Сохранить и уведомить клиента».

---

#### 13. Управление упражнениями тренера (`/trainer/exercises`)
Таблица упражнений тренера + системных.  
Форма создания: название, описание, группа мышц, загрузка видео.

---

#### 14. Шаблоны сообщений (`/trainer/templates`)
Список шаблонов с фильтром по типу (confirmation / reschedule / feedback).  
Кнопка отправки шаблона клиенту → создаёт уведомление.

---

#### 15. Управление пользователями (Администратор) (`/admin/users`)
Таблица всех пользователей:
- ФИО, Email, Роль, Статус, Дата регистрации
- Фильтры: по роли, по статусу, поиск по email/имени
- Сводные счётчики: всего тренеров, всего клиентов
- Кнопки: изменить роль, заблокировать/разблокировать

---

#### 16. Системные упражнения (Администратор) (`/admin/exercises`)
Аналог экрана упражнений тренера, но только для системных упражнений.

---

#### 17. Системные шаблоны (Администратор) (`/admin/templates`)
CRUD системных шаблонов сообщений.

---

## Функциональные модули Backend

| Модуль | Назначение |
|---|---|
| **Auth** | Регистрация, вход, генерация и верификация JWT, middleware RBAC |
| **Users** | CRUD учётных записей, управление ролями и статусом |
| **Trainers** | Профиль тренера, код приглашения |
| **Clients** | Профиль клиента, связь с тренером |
| **WorkoutPlans** | CRUD тренировочных программ, контроль уникальности активной программы |
| **Workouts** | CRUD тренировок, смена статуса, расписание |
| **Exercises** | Справочник упражнений (системные + пользовательские) |
| **WorkoutResults** | Плановые параметры (`workout_exercises`) и фактические результаты (`workout_exercise_results`) |
| **Notifications** | Автоматическое создание уведомлений, управление статусом прочтения |
| **MessageTemplates** | CRUD шаблонов, отправка шаблона → создание уведомления |
| **FoodLog** | Дневник питания по дням, CRUD приёмов пищи |
| **Media** | Загрузка файлов в S3, генерация presigned URLs |

---

## Нефункциональные требования

- **Производительность:** основные операции без значительных задержек, поддержка множества одновременных пользователей
- **Безопасность:** JWT + bcrypt, RBAC, HTTPS, разграничение по ролям
- **Доступность:** работа через браузер, без установки ПО; адаптивный дизайн (PC, планшет, смартфон)
- **Удобство:** интуитивный интерфейс, быстрое выполнение основных действий
- **Надёжность:** транзакционность операций (ACID), корректная обработка ошибок
- **Масштабируемость:** модульная архитектура, возможность добавления функционала без переработки ядра
- **Доступность (a11y):** контрастность ≥ WCAG AA (основные цветовые пары)

---

## Переменные окружения (`.env`)

```env
# Backend
DATABASE_URL=postgres://user:password@localhost:5432/fittrack
JWT_SECRET=supersecretkey
JWT_EXPIRE_HOURS=24
PORT=8080

# S3 / MinIO
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=fittrack-media
S3_REGION=us-east-1
S3_PRESIGN_TTL_SECONDS=3600

# Frontend
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

---

## Docker Compose (пример)

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: fittrack
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

  backend:
    build: ./backend
    env_file: .env
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - minio

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

volumes:
  pgdata:
  miniodata:
```

---

## Важные детали реализации

### Frontend

- Приватные маршруты защищены `PrivateRoute` — проверяют наличие токена и роль
- Токен хранится в `localStorage`, при запуске приложения проверяется его валидность
- Глобальный axios interceptor добавляет `Authorization: Bearer <token>` ко всем запросам и обрабатывает 401 (редирект на логин)
- Состояние уведомлений (счётчик непрочитанных) — в Zustand, обновляется polling'ом или после действий пользователя
- Адаптивность через CSS Grid + Flexbox, брейкпоинты: 768px (tablet), 1024px (desktop)

### Backend

- Каждый модуль имеет структуру: `handler.go` → `service.go` → `repository.go`
- Middleware порядок: logger → cors → auth (JWT parse) → role check → handler
- Email всегда нормализуется через `strings.ToLower()` перед сохранением
- При создании клиента: транзакция `BEGIN` → insert `users` → insert `clients` → `COMMIT`
- При завершении тренировки: транзакция → update `workouts.status = 'completed'` → insert `workout_exercise_results` → insert `notifications` → `COMMIT`
- Presigned URL генерируется методом `PresignGetObject` с TTL из конфига

### База данных

- Все `BIGSERIAL` первичные ключи
- Каскадное удаление (`ON DELETE CASCADE`) для зависимых записей
- Индексы: `idx_notifications_user (user_id, is_read)`, `idx_users_email`, `idx_one_active_plan (UNIQUE partial)`
- Все временны́е метки — `TIMESTAMP WITHOUT TIME ZONE`, хранятся в UTC

---

## Сценарий тестирования (минимальный)

1. Зарегистрировать администратора (seed-данные)
2. Администратор создаёт тренера → система генерирует invite_code
3. Клиент регистрируется с invite_code
4. Тренер создаёт активную программу для клиента
5. Тренер добавляет тренировку с упражнениями
6. Клиент получает уведомление `workout_assigned`
7. Клиент открывает тренировку, вводит результаты, нажимает «Завершить»
8. Тренер получает уведомление `workout_completed`
9. Тренер просматривает результаты, при необходимости корректирует программу
