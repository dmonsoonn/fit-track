package workouts

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Workout struct {
	WorkoutID       int64      `json:"workout_id"`
	WorkoutPlanID   int64      `json:"workout_plan_id"`
	ScheduledDate   time.Time  `json:"scheduled_date"`
	Status          string     `json:"status"`
	CompletedAt     *time.Time `json:"completed_at"`
	DurationMinutes *int       `json:"duration_minutes"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

const workoutCols = `workout_id, workout_plan_id, scheduled_date, status, completed_at, duration_minutes`

func scanWorkout(row pgx.Row) (*Workout, error) {
	w := &Workout{}
	err := row.Scan(&w.WorkoutID, &w.WorkoutPlanID, &w.ScheduledDate, &w.Status, &w.CompletedAt, &w.DurationMinutes)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return w, err
}

func (r *Repository) listByPlan(ctx context.Context, planID int64) ([]Workout, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+workoutCols+` FROM workouts WHERE workout_plan_id=$1 ORDER BY scheduled_date`, planID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Workout
	for rows.Next() {
		w := Workout{}
		if err := rows.Scan(&w.WorkoutID, &w.WorkoutPlanID, &w.ScheduledDate, &w.Status, &w.CompletedAt, &w.DurationMinutes); err != nil {
			return nil, err
		}
		list = append(list, w)
	}
	return list, rows.Err()
}

func (r *Repository) getByID(ctx context.Context, id int64) (*Workout, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+workoutCols+` FROM workouts WHERE workout_id=$1`, id)
	return scanWorkout(row)
}

// listForClientSchedule returns all workouts for the client (via plan chain).
func (r *Repository) listForClient(ctx context.Context, clientID int64) ([]Workout, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT w.workout_id, w.workout_plan_id, w.scheduled_date, w.status, w.completed_at, w.duration_minutes
		   FROM workouts w
		   JOIN workout_plans p ON p.workout_plan_id = w.workout_plan_id
		  WHERE p.client_id = $1
		  ORDER BY w.scheduled_date`, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Workout
	for rows.Next() {
		w := Workout{}
		if err := rows.Scan(&w.WorkoutID, &w.WorkoutPlanID, &w.ScheduledDate, &w.Status, &w.CompletedAt, &w.DurationMinutes); err != nil {
			return nil, err
		}
		list = append(list, w)
	}
	return list, rows.Err()
}

type createParams struct {
	PlanID          int64
	ScheduledDate   time.Time
	DurationMinutes *int
}

func (r *Repository) create(ctx context.Context, p createParams) (*Workout, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row := tx.QueryRow(ctx,
		`INSERT INTO workouts (workout_plan_id, scheduled_date, duration_minutes)
		 VALUES ($1,$2,$3) RETURNING `+workoutCols,
		p.PlanID, p.ScheduledDate, p.DurationMinutes,
	)
	w, err := scanWorkout(row)
	if err != nil {
		return nil, err
	}

	// Notify client that a workout has been assigned.
	var clientUserID int64
	var trainerFirst, trainerLast string
	if err := tx.QueryRow(ctx, `
		SELECT u.user_id, tu.first_name, tu.last_name
		  FROM workout_plans wp
		  JOIN clients c   ON c.client_id   = wp.client_id
		  JOIN users u     ON u.user_id     = c.user_id
		  JOIN trainers t  ON t.trainer_id  = c.trainer_id
		  JOIN users tu    ON tu.user_id    = t.user_id
		 WHERE wp.workout_plan_id = $1`, p.PlanID,
	).Scan(&clientUserID, &trainerFirst, &trainerLast); err == nil && clientUserID != 0 {
		trainerName := trainerFirst + " " + trainerLast
		_, _ = tx.Exec(ctx,
			`INSERT INTO notifications (user_id, type, text, sender_name)
			 VALUES ($1, 'workout_assigned', 'Вам назначена новая тренировка', $2)`, clientUserID, trainerName,
		)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return w, nil
}

type patchParams struct {
	ScheduledDate   *time.Time
	DurationMinutes *int
	Status          *string
}

func (r *Repository) patch(ctx context.Context, id int64, p patchParams) (*Workout, error) {
	if p.ScheduledDate != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE workouts SET scheduled_date=$1 WHERE workout_id=$2", *p.ScheduledDate, id); err != nil {
			return nil, err
		}
	}
	if p.DurationMinutes != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE workouts SET duration_minutes=$1 WHERE workout_id=$2", *p.DurationMinutes, id); err != nil {
			return nil, err
		}
	}
	if p.Status != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE workouts SET status=$1 WHERE workout_id=$2", *p.Status, id); err != nil {
			return nil, err
		}
	}
	return r.getByID(ctx, id)
}

func (r *Repository) delete(ctx context.Context, id int64) error {
	tag, err := r.pool.Exec(ctx, "DELETE FROM workouts WHERE workout_id=$1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// complete marks workout as completed in a transaction and creates a notification for the trainer.
func (r *Repository) complete(ctx context.Context, workoutID, trainerUserID int64) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx,
		"UPDATE workouts SET status='completed', completed_at=NOW() WHERE workout_id=$1", workoutID,
	); err != nil {
		return err
	}

	// Resolve client name for a more informative notification.
	notifText := "Клиент завершил тренировку"
	var senderName *string
	var firstName, lastName string
	if err := tx.QueryRow(ctx, `
		SELECT u.first_name, u.last_name
		  FROM workouts w
		  JOIN workout_plans p ON p.workout_plan_id = w.workout_plan_id
		  JOIN clients c       ON c.client_id = p.client_id
		  JOIN users u         ON u.user_id   = c.user_id
		 WHERE w.workout_id = $1`, workoutID,
	).Scan(&firstName, &lastName); err == nil {
		fullName := firstName + " " + lastName
		notifText = fullName + " завершил(а) тренировку"
		senderName = &fullName
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO notifications (user_id, type, text, sender_name)
		 VALUES ($1, 'workout_completed', $2, $3)`, trainerUserID, notifText, senderName,
	); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
