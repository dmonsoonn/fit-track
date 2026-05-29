-- ENUM types
CREATE TYPE user_role       AS ENUM ('admin', 'trainer', 'client');
CREATE TYPE fitness_level   AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE workout_status  AS ENUM ('planned', 'completed', 'skipped');
CREATE TYPE template_scope  AS ENUM ('system', 'trainer', 'client');
CREATE TYPE template_type   AS ENUM ('confirmation', 'reschedule', 'feedback');
CREATE TYPE notification_type AS ENUM ('workout_assigned', 'workout_completed', 'message');

-- users
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

-- trainers
CREATE TABLE trainers (
    trainer_id     BIGSERIAL    PRIMARY KEY,
    user_id        BIGINT       NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    specialization VARCHAR(255),
    invite_code    VARCHAR(20)  NOT NULL UNIQUE
);

-- clients
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

-- workout_plans
CREATE TABLE workout_plans (
    workout_plan_id BIGSERIAL    PRIMARY KEY,
    client_id       BIGINT       NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
    title           VARCHAR(100) NOT NULL,
    description     VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    end_date        TIMESTAMPTZ
);
-- At most one active plan per client
CREATE UNIQUE INDEX idx_one_active_plan ON workout_plans (client_id) WHERE is_active = TRUE;

-- workouts
CREATE TABLE workouts (
    workout_id       BIGSERIAL      PRIMARY KEY,
    workout_plan_id  BIGINT         NOT NULL REFERENCES workout_plans(workout_plan_id) ON DELETE CASCADE,
    scheduled_date   TIMESTAMPTZ    NOT NULL,
    status           workout_status NOT NULL DEFAULT 'planned',
    completed_at     TIMESTAMPTZ,
    duration_minutes INTEGER        CHECK (duration_minutes > 0)
);

-- exercises
CREATE TABLE exercises (
    exercise_id  BIGSERIAL    PRIMARY KEY,
    trainer_id   BIGINT       REFERENCES trainers(trainer_id) ON DELETE SET NULL,
    name         VARCHAR(100) NOT NULL,
    description  VARCHAR(255),
    muscle_group VARCHAR(100),
    video_url    VARCHAR(500)
);

-- workout_exercises (planned parameters)
CREATE TABLE workout_exercises (
    workout_exercise_id BIGSERIAL   PRIMARY KEY,
    workout_id          BIGINT      NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
    exercise_id         BIGINT      NOT NULL REFERENCES exercises(exercise_id),
    sets                INTEGER     NOT NULL CHECK (sets > 0),
    reps                INTEGER     NOT NULL CHECK (reps > 0),
    weight              NUMERIC(6,2) CHECK (weight >= 0),
    "order"             INTEGER     NOT NULL
);

-- workout_exercise_results (actual results)
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

-- message_templates
CREATE TABLE message_templates (
    message_template_id BIGSERIAL      PRIMARY KEY,
    user_id             BIGINT         REFERENCES users(user_id) ON DELETE CASCADE,
    text                VARCHAR(255)   NOT NULL,
    type                template_type  NOT NULL,
    scope               template_scope NOT NULL
);

-- notifications
CREATE TABLE notifications (
    notification_id BIGSERIAL         PRIMARY KEY,
    user_id         BIGINT            NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type            notification_type NOT NULL,
    text            VARCHAR(255)      NOT NULL,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    is_read         BOOLEAN           NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_notifications_user ON notifications (user_id, is_read);

-- food_logs
CREATE TABLE food_logs (
    food_log_id BIGSERIAL PRIMARY KEY,
    client_id   BIGINT    NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
    date        DATE      NOT NULL,
    UNIQUE (client_id, date)
);

-- food_entries
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
