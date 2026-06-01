package stats

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

func (s *Service) GetStats(ctx context.Context) (*StatsResponse, error) {
	return s.repo.getStats(ctx)
}
