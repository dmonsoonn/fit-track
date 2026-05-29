package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type dbUser struct {
	UserID       int64
	Email        string
	FirstName    string
	LastName     string
	PasswordHash string
	Role         string
}

func (r *Repository) emailExists(ctx context.Context, email string) (bool, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER($1)", email,
	).Scan(&count)
	return count > 0, err
}

func (r *Repository) getUserByEmail(ctx context.Context, email string) (*dbUser, error) {
	u := &dbUser{}
	err := r.pool.QueryRow(ctx,
		`SELECT user_id, email, first_name, last_name, password_hash, role
		   FROM users WHERE LOWER(email) = LOWER($1) AND is_active = TRUE`, email,
	).Scan(&u.UserID, &u.Email, &u.FirstName, &u.LastName, &u.PasswordHash, &u.Role)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

type createUserParams struct {
	Email        string
	FirstName    string
	LastName     string
	PasswordHash string
	Role         string
}

func (r *Repository) createUserTx(ctx context.Context, tx pgx.Tx, p createUserParams) (int64, error) {
	var id int64
	err := tx.QueryRow(ctx,
		`INSERT INTO users (email, first_name, last_name, password_hash, role)
		 VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
		p.Email, p.FirstName, p.LastName, p.PasswordHash, p.Role,
	).Scan(&id)
	return id, err
}

func (r *Repository) createTrainerTx(ctx context.Context, tx pgx.Tx, userID int64, inviteCode string) error {
	_, err := tx.Exec(ctx,
		`INSERT INTO trainers (user_id, invite_code) VALUES ($1, $2)`,
		userID, inviteCode,
	)
	return err
}

func (r *Repository) getTrainerIDByInviteCode(ctx context.Context, inviteCode string) (int64, error) {
	var id int64
	err := r.pool.QueryRow(ctx,
		"SELECT trainer_id FROM trainers WHERE invite_code = $1", inviteCode,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, errInvalidInviteCode
	}
	return id, err
}

func (r *Repository) createClientTx(ctx context.Context, tx pgx.Tx, userID, trainerID int64) error {
	_, err := tx.Exec(ctx,
		`INSERT INTO clients (user_id, trainer_id) VALUES ($1, $2)`,
		userID, trainerID,
	)
	return err
}

func generateInviteCode() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
