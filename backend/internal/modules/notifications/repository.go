package notifications

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Notification struct {
	NotificationID int64     `json:"notification_id"`
	UserID         int64     `json:"user_id"`
	Type           string    `json:"type"`
	Text           string    `json:"text"`
	CreatedAt      time.Time `json:"created_at"`
	IsRead         bool      `json:"is_read"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) listForUser(ctx context.Context, userID int64) ([]Notification, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT notification_id, user_id, type, text, created_at, is_read
		   FROM notifications WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Notification
	for rows.Next() {
		n := Notification{}
		if err := rows.Scan(&n.NotificationID, &n.UserID, &n.Type, &n.Text, &n.CreatedAt, &n.IsRead); err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	return list, rows.Err()
}

func (r *Repository) markRead(ctx context.Context, notificationID, userID int64) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE notifications SET is_read=TRUE WHERE notification_id=$1 AND user_id=$2",
		notificationID, userID)
	return err
}

func (r *Repository) markAllRead(ctx context.Context, userID int64) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND is_read=FALSE", userID)
	return err
}
