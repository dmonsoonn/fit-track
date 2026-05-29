package workout_plans

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WorkoutPlan struct {
	WorkoutPlanID int64      `json:"workout_plan_id"`
	ClientID      int64      `json:"client_id"`
	Title         string     `json:"title"`
	Description   *string    `json:"description"`
	CreatedAt     time.Time  `json:"created_at"`
	IsActive      bool       `json:"is_active"`
	EndDate       *time.Time `json:"end_date"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

const planCols = `workout_plan_id, client_id, title, description, created_at, is_active, end_date`

func scanPlan(row pgx.Row) (*WorkoutPlan, error) {
	p := &WorkoutPlan{}
	err := row.Scan(&p.WorkoutPlanID, &p.ClientID, &p.Title, &p.Description, &p.CreatedAt, &p.IsActive, &p.EndDate)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return p, err
}

func (r *Repository) listByClient(ctx context.Context, clientID int64) ([]WorkoutPlan, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+planCols+` FROM workout_plans WHERE client_id=$1 ORDER BY created_at DESC`, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []WorkoutPlan
	for rows.Next() {
		p := WorkoutPlan{}
		if err := rows.Scan(&p.WorkoutPlanID, &p.ClientID, &p.Title, &p.Description, &p.CreatedAt, &p.IsActive, &p.EndDate); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, rows.Err()
}

func (r *Repository) getByID(ctx context.Context, id int64) (*WorkoutPlan, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+planCols+` FROM workout_plans WHERE workout_plan_id=$1`, id)
	return scanPlan(row)
}

func (r *Repository) getActivePlanByClient(ctx context.Context, clientID int64) (*WorkoutPlan, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT `+planCols+` FROM workout_plans WHERE client_id=$1 AND is_active=TRUE`, clientID)
	return scanPlan(row)
}

type createParams struct {
	ClientID    int64
	Title       string
	Description *string
	IsActive    bool
	EndDate     *time.Time
}

func (r *Repository) create(ctx context.Context, p createParams) (*WorkoutPlan, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if p.IsActive {
		// deactivate current active plan
		if _, err := tx.Exec(ctx,
			"UPDATE workout_plans SET is_active=FALSE WHERE client_id=$1 AND is_active=TRUE", p.ClientID,
		); err != nil {
			return nil, err
		}
	}

	plan := &WorkoutPlan{}
	err = tx.QueryRow(ctx,
		`INSERT INTO workout_plans (client_id, title, description, is_active, end_date)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING `+planCols,
		p.ClientID, p.Title, p.Description, p.IsActive, p.EndDate,
	).Scan(&plan.WorkoutPlanID, &plan.ClientID, &plan.Title, &plan.Description, &plan.CreatedAt, &plan.IsActive, &plan.EndDate)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return plan, nil
}

type patchParams struct {
	Title       *string
	Description *string
	IsActive    *bool
	EndDate     *time.Time
}

func (r *Repository) patch(ctx context.Context, id int64, p patchParams) (*WorkoutPlan, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// If activating this plan, deactivate others for the same client
	if p.IsActive != nil && *p.IsActive {
		var clientID int64
		if err := tx.QueryRow(ctx, "SELECT client_id FROM workout_plans WHERE workout_plan_id=$1", id).Scan(&clientID); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx,
			"UPDATE workout_plans SET is_active=FALSE WHERE client_id=$1 AND is_active=TRUE AND workout_plan_id<>$2",
			clientID, id,
		); err != nil {
			return nil, err
		}
	}

	if p.Title != nil {
		if _, err := tx.Exec(ctx, "UPDATE workout_plans SET title=$1 WHERE workout_plan_id=$2", *p.Title, id); err != nil {
			return nil, err
		}
	}
	if p.Description != nil {
		if _, err := tx.Exec(ctx, "UPDATE workout_plans SET description=$1 WHERE workout_plan_id=$2", *p.Description, id); err != nil {
			return nil, err
		}
	}
	if p.IsActive != nil {
		if _, err := tx.Exec(ctx, "UPDATE workout_plans SET is_active=$1 WHERE workout_plan_id=$2", *p.IsActive, id); err != nil {
			return nil, err
		}
	}
	if p.EndDate != nil {
		if _, err := tx.Exec(ctx, "UPDATE workout_plans SET end_date=$1 WHERE workout_plan_id=$2", *p.EndDate, id); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.getByID(ctx, id)
}

func (r *Repository) delete(ctx context.Context, id int64) error {
	tag, err := r.pool.Exec(ctx, "DELETE FROM workout_plans WHERE workout_plan_id=$1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
