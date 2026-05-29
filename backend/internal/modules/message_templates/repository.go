package message_templates

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type MessageTemplate struct {
	MessageTemplateID int64   `json:"message_template_id"`
	UserID            *int64  `json:"user_id"`
	Text              string  `json:"text"`
	Type              string  `json:"type"`
	Scope             string  `json:"scope"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// list returns system templates + templates owned by userID.
func (r *Repository) list(ctx context.Context, userID int64) ([]MessageTemplate, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT message_template_id, user_id, text, type, scope
		   FROM message_templates
		  WHERE scope = 'system' OR user_id = $1
		  ORDER BY scope, type`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []MessageTemplate
	for rows.Next() {
		t := MessageTemplate{}
		if err := rows.Scan(&t.MessageTemplateID, &t.UserID, &t.Text, &t.Type, &t.Scope); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

type createParams struct {
	UserID *int64
	Text   string
	Type   string
	Scope  string
}

func (r *Repository) create(ctx context.Context, p createParams) (*MessageTemplate, error) {
	t := &MessageTemplate{}
	err := r.pool.QueryRow(ctx,
		`INSERT INTO message_templates (user_id, text, type, scope)
		 VALUES ($1,$2,$3,$4)
		 RETURNING message_template_id, user_id, text, type, scope`,
		p.UserID, p.Text, p.Type, p.Scope,
	).Scan(&t.MessageTemplateID, &t.UserID, &t.Text, &t.Type, &t.Scope)
	return t, err
}

func (r *Repository) delete(ctx context.Context, id, userID int64, isAdmin bool) (bool, error) {
	var tag interface{ RowsAffected() int64 }
	var err error
	if isAdmin {
		tag, err = r.pool.Exec(ctx, "DELETE FROM message_templates WHERE message_template_id=$1", id)
	} else {
		tag, err = r.pool.Exec(ctx,
			"DELETE FROM message_templates WHERE message_template_id=$1 AND user_id=$2", id, userID)
	}
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}
