package notifications

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	repo *Repository
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{repo: NewRepository(pool)}
}

func (s *Service) List(ctx context.Context, userID int64) ([]Notification, error) {
	list, err := s.repo.listForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if list == nil {
		return []Notification{}, nil
	}
	return list, nil
}

func (s *Service) MarkRead(ctx context.Context, notificationID, userID int64) error {
	return s.repo.markRead(ctx, notificationID, userID)
}

func (s *Service) MarkAllRead(ctx context.Context, userID int64) error {
	return s.repo.markAllRead(ctx, userID)
}

func (s *Service) Delete(ctx context.Context, notificationID, userID int64) error {
	return s.repo.deleteByID(ctx, notificationID, userID)
}

func (s *Service) DeleteAll(ctx context.Context, userID int64) error {
	return s.repo.deleteAll(ctx, userID)
}
