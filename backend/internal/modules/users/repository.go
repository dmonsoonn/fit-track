package users

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type User struct {
	UserID    int64     `json:"user_id"`
	Email     string    `json:"email"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	IsActive  bool      `json:"is_active"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) list(ctx context.Context) ([]User, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT user_id, email, first_name, last_name, role, created_at, is_active
		   FROM users ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.UserID, &u.Email, &u.FirstName, &u.LastName, &u.Role, &u.CreatedAt, &u.IsActive); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *Repository) getByID(ctx context.Context, id int64) (*User, error) {
	u := &User{}
	err := r.pool.QueryRow(ctx,
		`SELECT user_id, email, first_name, last_name, role, created_at, is_active
		   FROM users WHERE user_id = $1`, id,
	).Scan(&u.UserID, &u.Email, &u.FirstName, &u.LastName, &u.Role, &u.CreatedAt, &u.IsActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

type patchParams struct {
	Role     *string
	IsActive *bool
}

func (r *Repository) patch(ctx context.Context, id int64, p patchParams) (*User, error) {
	if p.Role != nil {
		if _, err := r.pool.Exec(ctx,
			"UPDATE users SET role = $1 WHERE user_id = $2", *p.Role, id,
		); err != nil {
			return nil, err
		}
	}
	if p.IsActive != nil {
		if _, err := r.pool.Exec(ctx,
			"UPDATE users SET is_active = $1 WHERE user_id = $2", *p.IsActive, id,
		); err != nil {
			return nil, err
		}
	}
	return r.getByID(ctx, id)
}

func (r *Repository) delete(ctx context.Context, id int64) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Delete clients that belong to this trainer (if any) before removing the user,
	// because clients.trainer_id → trainers.trainer_id has no ON DELETE CASCADE.
	if _, err := tx.Exec(ctx,
		`DELETE FROM clients WHERE trainer_id IN (
		   SELECT trainer_id FROM trainers WHERE user_id = $1
		 )`, id,
	); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, "DELETE FROM users WHERE user_id = $1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	return tx.Commit(ctx)
}
