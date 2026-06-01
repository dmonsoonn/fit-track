package clients

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Client struct {
	ClientID        int64      `json:"client_id"`
	UserID          int64      `json:"user_id"`
	TrainerID       int64      `json:"trainer_id"`
	Email           string     `json:"email"`
	FirstName       string     `json:"first_name"`
	LastName        string     `json:"last_name"`
	Goal            *string    `json:"goal"`
	Weight          *float64   `json:"weight"`
	Height          *float64   `json:"height"`
	Level           *string    `json:"level"`
	HealthNotes     *string    `json:"health_notes"`
	DateOfBirth     *time.Time `json:"date_of_birth"`
	ActivePlan      *string    `json:"active_plan,omitempty"`
	TrainerFirstName string    `json:"trainer_first_name,omitempty"`
	TrainerLastName  string    `json:"trainer_last_name,omitempty"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

const clientSelect = `
	SELECT c.client_id, c.user_id, c.trainer_id, u.email, u.first_name, u.last_name,
	       c.goal, c.weight, c.height, c.level, c.health_notes, c.date_of_birth
	  FROM clients c JOIN users u ON u.user_id = c.user_id`

// clientSelectWithTrainer is used for /clients/me — includes trainer name via extra JOINs.
const clientSelectWithTrainer = `
	SELECT c.client_id, c.user_id, c.trainer_id, u.email, u.first_name, u.last_name,
	       c.goal, c.weight, c.height, c.level, c.health_notes, c.date_of_birth,
	       tu.first_name, tu.last_name
	  FROM clients c
	  JOIN users u   ON u.user_id   = c.user_id
	  JOIN trainers t ON t.trainer_id = c.trainer_id
	  JOIN users tu  ON tu.user_id  = t.user_id`

func scanClient(row pgx.Row) (*Client, error) {
	cl := &Client{}
	err := row.Scan(
		&cl.ClientID, &cl.UserID, &cl.TrainerID, &cl.Email,
		&cl.FirstName, &cl.LastName, &cl.Goal, &cl.Weight,
		&cl.Height, &cl.Level, &cl.HealthNotes, &cl.DateOfBirth,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return cl, err
}

func scanClientWithTrainer(row pgx.Row) (*Client, error) {
	cl := &Client{}
	err := row.Scan(
		&cl.ClientID, &cl.UserID, &cl.TrainerID, &cl.Email,
		&cl.FirstName, &cl.LastName, &cl.Goal, &cl.Weight,
		&cl.Height, &cl.Level, &cl.HealthNotes, &cl.DateOfBirth,
		&cl.TrainerFirstName, &cl.TrainerLastName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return cl, err
}

func (r *Repository) listByTrainer(ctx context.Context, trainerID int64) ([]Client, error) {
	const q = `
		SELECT c.client_id, c.user_id, c.trainer_id, u.email, u.first_name, u.last_name,
		       c.goal, c.weight, c.height, c.level, c.health_notes, c.date_of_birth,
		       (SELECT wp.title FROM workout_plans wp
		          WHERE wp.client_id = c.client_id AND wp.is_active = TRUE
		          LIMIT 1) AS active_plan
		  FROM clients c JOIN users u ON u.user_id = c.user_id
		 WHERE c.trainer_id = $1
		 ORDER BY u.last_name, u.first_name`

	rows, err := r.pool.Query(ctx, q, trainerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Client
	for rows.Next() {
		cl := Client{}
		if err := rows.Scan(
			&cl.ClientID, &cl.UserID, &cl.TrainerID, &cl.Email,
			&cl.FirstName, &cl.LastName, &cl.Goal, &cl.Weight,
			&cl.Height, &cl.Level, &cl.HealthNotes, &cl.DateOfBirth,
			&cl.ActivePlan,
		); err != nil {
			return nil, err
		}
		list = append(list, cl)
	}
	return list, rows.Err()
}

func (r *Repository) getByClientID(ctx context.Context, clientID int64) (*Client, error) {
	row := r.pool.QueryRow(ctx, clientSelect+` WHERE c.client_id = $1`, clientID)
	return scanClient(row)
}

func (r *Repository) getByUserID(ctx context.Context, userID int64) (*Client, error) {
	row := r.pool.QueryRow(ctx, clientSelectWithTrainer+` WHERE c.user_id = $1`, userID)
	return scanClientWithTrainer(row)
}

// getTrainerIDByClientID returns trainer_id for the given client.
func (r *Repository) getTrainerIDByClientID(ctx context.Context, clientID int64) (int64, error) {
	var tid int64
	err := r.pool.QueryRow(ctx,
		"SELECT trainer_id FROM clients WHERE client_id = $1", clientID,
	).Scan(&tid)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	return tid, err
}

type patchParams struct {
	FirstName   *string
	LastName    *string
	Goal        *string
	Weight      *float64
	Height      *float64
	Level       *string
	HealthNotes *string
	DateOfBirth *time.Time
}

func (r *Repository) patchByUserID(ctx context.Context, userID int64, p patchParams) error {
	if p.FirstName != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE users SET first_name=$1 WHERE user_id=$2", *p.FirstName, userID); err != nil {
			return err
		}
	}
	if p.LastName != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE users SET last_name=$1 WHERE user_id=$2", *p.LastName, userID); err != nil {
			return err
		}
	}
	if p.Goal != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE clients SET goal=$1 WHERE user_id=$2", *p.Goal, userID); err != nil {
			return err
		}
	}
	if p.Weight != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE clients SET weight=$1 WHERE user_id=$2", *p.Weight, userID); err != nil {
			return err
		}
	}
	if p.Height != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE clients SET height=$1 WHERE user_id=$2", *p.Height, userID); err != nil {
			return err
		}
	}
	if p.Level != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE clients SET level=$1 WHERE user_id=$2", *p.Level, userID); err != nil {
			return err
		}
	}
	if p.HealthNotes != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE clients SET health_notes=$1 WHERE user_id=$2", *p.HealthNotes, userID); err != nil {
			return err
		}
	}
	if p.DateOfBirth != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE clients SET date_of_birth=$1 WHERE user_id=$2", *p.DateOfBirth, userID); err != nil {
			return err
		}
	}
	return nil
}
