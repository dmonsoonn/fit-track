package trainers

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Trainer struct {
	TrainerID      int64   `json:"trainer_id"`
	UserID         int64   `json:"user_id"`
	Email          string  `json:"email"`
	FirstName      string  `json:"first_name"`
	LastName       string  `json:"last_name"`
	Specialization *string `json:"specialization"`
	InviteCode     string  `json:"invite_code"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) getByUserID(ctx context.Context, userID int64) (*Trainer, error) {
	t := &Trainer{}
	err := r.pool.QueryRow(ctx,
		`SELECT t.trainer_id, t.user_id, u.email, u.first_name, u.last_name,
		        t.specialization, t.invite_code
		   FROM trainers t JOIN users u ON u.user_id = t.user_id
		  WHERE t.user_id = $1`, userID,
	).Scan(&t.TrainerID, &t.UserID, &t.Email, &t.FirstName, &t.LastName,
		&t.Specialization, &t.InviteCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return t, err
}

type patchParams struct {
	Specialization *string
	FirstName      *string
	LastName       *string
}

func (r *Repository) patch(ctx context.Context, userID int64, p patchParams) error {
	if p.FirstName != nil {
		if _, err := r.pool.Exec(ctx,
			"UPDATE users SET first_name = $1 WHERE user_id = $2", *p.FirstName, userID,
		); err != nil {
			return err
		}
	}
	if p.LastName != nil {
		if _, err := r.pool.Exec(ctx,
			"UPDATE users SET last_name = $1 WHERE user_id = $2", *p.LastName, userID,
		); err != nil {
			return err
		}
	}
	if p.Specialization != nil {
		if _, err := r.pool.Exec(ctx,
			"UPDATE trainers SET specialization = $1 WHERE user_id = $2", *p.Specialization, userID,
		); err != nil {
			return err
		}
	}
	return nil
}
