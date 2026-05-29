package message_templates

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	errNotFound  = errors.New("not found")
	errForbidden = errors.New("forbidden")
)

type Service struct {
	repo *Repository
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{repo: NewRepository(pool), pool: pool}
}

func (s *Service) List(ctx context.Context, userID int64) ([]MessageTemplate, error) {
	list, err := s.repo.list(ctx, userID)
	if err != nil {
		return nil, err
	}
	if list == nil {
		return []MessageTemplate{}, nil
	}
	return list, nil
}

type CreateRequest struct {
	Text  string `json:"text"`
	Type  string `json:"type"`
	Scope string `json:"scope"`
}

func (s *Service) Create(ctx context.Context, userID int64, role string, req CreateRequest) (*MessageTemplate, error) {
	if req.Text == "" || req.Type == "" {
		return nil, errors.New("text and type are required")
	}
	validTypes := map[string]bool{"confirmation": true, "reschedule": true, "feedback": true}
	if !validTypes[req.Type] {
		return nil, errors.New("invalid type")
	}

	scope := "trainer"
	var uid *int64
	if role == "admin" && req.Scope == "system" {
		scope = "system"
	} else {
		uid = &userID
	}

	return s.repo.create(ctx, createParams{
		UserID: uid,
		Text:   req.Text,
		Type:   req.Type,
		Scope:  scope,
	})
}

func (s *Service) Delete(ctx context.Context, id, userID int64, role string) error {
	isAdmin := role == "admin"
	deleted, err := s.repo.delete(ctx, id, userID, isAdmin)
	if err != nil {
		return err
	}
	if !deleted {
		return errNotFound
	}
	return nil
}

// Send creates a notification for clientID using the given template.
func (s *Service) Send(ctx context.Context, templateID, clientUserID int64) error {
	// Get template
	rows, err := s.pool.Query(ctx,
		"SELECT text FROM message_templates WHERE message_template_id=$1", templateID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var text string
	if rows.Next() {
		if err := rows.Scan(&text); err != nil {
			return err
		}
	} else {
		return errNotFound
	}

	_, err = s.pool.Exec(ctx,
		`INSERT INTO notifications (user_id, type, text) VALUES ($1, 'message', $2)`,
		clientUserID, text)
	return err
}
