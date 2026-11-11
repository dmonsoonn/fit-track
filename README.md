# FitTrack

Веб-платформа для фитнес-тренера: ведение клиентов, тренировочные программы, выполнение тренировок с фиксацией результатов, дневник питания и уведомления — в одном приложении для тренера и его клиентов.

![Go](https://img.shields.io/badge/Go-1.25-00ADD8?logo=go&logoColor=white)
![Fiber](https://img.shields.io/badge/Fiber-v2-00ACD7)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

---

## Возможности

### Клиент
- Регистрация по коду приглашения тренера.
- Личный кабинет: цель, вес, рост, уровень подготовки, ограничения по здоровью.
- Расписание тренировок по датам со статусом выполнения.
- Выполнение тренировки: план по каждому упражнению, видео, ввод фактических подходов, повторений, веса и комментария.
- Прогресс: счётчики тренировок, процент выполнения и график завершённых тренировок по неделям.
- Дневник питания по дням: калории, белки, жиры, углеводы и итог за день.

### Тренер
- Профиль и код приглашения для клиентов.
- Список клиентов и карточка клиента: профиль, программа, результаты, питание.
- Тренировочные программы (у клиента одна активная) и тренировки с упражнениями.
- Собственный справочник упражнений с загрузкой видео.
- Шаблоны сообщений и отправка их клиентам.

### Администратор
- Дашборд: метрики, активность, распределение целей, топ тренеров, новые регистрации.
- Управление пользователями: фильтры, поиск, смена роли, блокировка, удаление.
- Системные упражнения и системные шаблоны сообщений.

### Уведомления
Клиент получает уведомление, когда тренер назначает тренировку. Тренер получает уведомление, когда клиент её завершает. Счётчик непрочитанных обновляется автоматически.

---

## Стек

| Слой | Технологии |
|---|---|
| Backend | Go 1.25, Fiber v2, pgx/v5, golang-jwt (HS256), bcrypt, aws-sdk-go-v2 |
| Frontend | React 18, TypeScript, Vite 6, React Router v6, TanStack Query v5, Zustand, Axios, Tailwind CSS, recharts, lucide-react |
| Данные | PostgreSQL 16, MinIO (S3-совместимое хранилище для видео) |
| Инфраструктура | Docker Compose, nginx (раздача собранного фронта) |
| Тесты | Playwright (e2e), Python-смоук по API, k6 (нагрузка) |

---

## Архитектура

```mermaid
flowchart LR
    U[Браузер] --> SPA[React SPA<br/>Vite / nginx :5173]
    SPA -- "REST /api/v1<br/>JWT Bearer" --> API[Go + Fiber API<br/>:8080]
    API --> PG[(PostgreSQL 16<br/>:5433)]
    API -- "загрузка видео,<br/>presigned URL" --> S3[(MinIO<br/>:9000)]
    SPA -. "просмотр видео<br/>по presigned URL" .-> S3
```

- **API** разбит на модули (`auth`, `clients`, `workouts`, `exercises`, `food_log`, `notifications` и т.д.). Каждый модуль устроен по схеме `handler → service → repository`.
- **Доступ** проверяет JWT-middleware и проверка ролей (`client`, `trainer`, `admin`). Владение данными проверяется в сервисах.
- **Миграции** встроены в бинарник и применяются автоматически при старте сервера.

### Основной сценарий

```mermaid
sequenceDiagram
    actor T as Тренер
    participant API as FitTrack API
    actor C as Клиент

    T->>API: Создаёт программу и тренировку с упражнениями
    API-->>C: Уведомление «Вам назначена новая тренировка»
    C->>API: Открывает тренировку и вводит фактические результаты
    C->>API: Завершает тренировку
    API-->>T: Уведомление «Клиент завершил тренировку»
    T->>API: Смотрит результаты, при необходимости правит программу
```

---

## Быстрый старт

### Требования
- Docker с Docker Compose
- Go 1.25+
- Node.js 20+ и npm
- make

### Запуск для разработки

```bash
git clone https://github.com/dmonsoonn/fit-track.git
cd fit-track

cp .env.example .env
cp .env.example backend/.env

make dev
```

Конфиг нужен в двух местах. `make dev` запускает бэкенд из `backend/` и читает `backend/.env`. Docker Compose читает корневой `.env`.

`make dev` делает три вещи:
1. Поднимает PostgreSQL и MinIO в Docker.
2. Ставит зависимости фронта.
3. Запускает бэкенд и Vite одновременно. Остановить оба — `Ctrl+C`.

Миграции применяются при старте бэкенда.

В соседнем терминале создайте администратора:

```bash
make seed
```

| Сервис | Адрес |
|---|---|
| Приложение | http://localhost:5173 |
| API | http://localhost:8080/api/v1 |
| PostgreSQL | `localhost:5433`, БД `fittrack`, пользователь `user` / `password` |
| Консоль MinIO | http://localhost:9001 (`minioadmin` / `minioadmin`) |

**Администратор** (из `.env.example`): `admin@fittrack.local` / `admin1234`.

**Тренер и клиент:** зарегистрируйте тренера на `/register` и скопируйте его код приглашения из профиля. Затем зарегистрируйте клиента с этим кодом.

### Всё в Docker

```bash
cp .env.example .env
make up
```

Перед `make up` поправьте в корневом `.env` адреса. Внутри контейнера бэкенда `localhost` указывает на сам контейнер, поэтому нужны имена сервисов:

```env
DATABASE_URL=postgres://user:password@postgres:5432/fittrack?sslmode=disable
S3_ENDPOINT=http://minio:9000
```

Фронт собирается в статику и раздаётся через nginx на http://localhost:5173. Адрес API вшивается при сборке (build-arg `VITE_API_BASE_URL`).

Ограничение: presigned-ссылки на видео в этом режиме содержат хост `minio`, и браузер не сможет их открыть. Для работы с видео используйте `make dev`.

Администратора создаёт `make seed`. Он запускается локально и читает `backend/.env` (см. «Запуск для разработки»).

---

## Команды

| Команда | Что делает |
|---|---|
| `make dev` | Инфраструктура + бэкенд + фронт вместе |
| `make dev-backend` | Инфраструктура + только бэкенд |
| `make infra` | Только PostgreSQL и MinIO |
| `make web` | Только фронт (Vite, :5173) |
| `make seed` | Создать администратора |
| `make build` / `make run` | Собрать / запустить бинарник `backend/bin/server` |
| `make web-build` | Тайпчек и production-сборка фронта |
| `make up` / `make down` | Поднять / остановить весь стек в Docker |
| `make tidy` | `go mod tidy` |
| `make help` | Список всех целей |

---

## Тестирование

Нужен запущенный стек (`make dev`) и созданный администратор (`make seed`). Команды выполняются из корня репозитория.

**E2E (Playwright)** — сценарии для всех трёх ролей. Тестовые пользователи создаются автоматически через API:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
npm run test:e2e:report
cd ..
```

**Смоук по API** — проходит основной сценарий реальными HTTP-запросами:

```bash
python3 backend/e2e_test.py
```

**Нагрузка (k6)**, требуется [k6](https://k6.io):

```bash
k6 run --env FT_TYPE=smoke k6/load-test.js
k6 run --env FT_TYPE=load k6/load-test.js
k6 run --env FT_TYPE=stress k6/load-test.js
k6 run --env FT_TYPE=bench --env FT_VUS=50 k6/load-test.js
```

Отчёты сохраняются в `k6/reports/`.

**Статические проверки:**

```bash
(cd backend && go vet ./...)
(cd frontend && npm run lint)
```

---

## Структура репозитория

```
fit-track/
├── backend/
│   ├── cmd/server/          точка входа API
│   ├── cmd/seed/            создание администратора
│   ├── internal/
│   │   ├── modules/         доменные модули: handler → service → repository
│   │   ├── middleware/      JWT и проверка ролей
│   │   ├── db/migrations/   SQL-миграции
│   │   ├── storage/         S3-клиент
│   │   └── ...              config, response, types
│   └── e2e_test.py          смоук-тест API
├── frontend/
│   ├── src/
│   │   ├── api/             axios-клиент и API по доменам
│   │   ├── pages/           экраны: auth, client, trainer, admin, shared
│   │   ├── components/      UI-кит и layout
│   │   ├── store/           Zustand (сессия, счётчик уведомлений)
│   │   └── lib/             навигация, форматирование, утилиты
│   └── tests/e2e/           Playwright-тесты
├── k6/                      нагрузочные сценарии
├── docs/spec.md             полная спецификация
├── docker-compose.yml
└── Makefile
```

---

## Документация

- [Спецификация](docs/spec.md) — схема БД, все эндпоинты API с ролями, экраны, бизнес-правила, дизайн-токены, переменные окружения.
- [Известные проблемы](docs/spec.md#известные-проблемы) — что уже найдено и пока не исправлено.
- [Найденные e2e-баги](frontend/tests/bugs.md).
