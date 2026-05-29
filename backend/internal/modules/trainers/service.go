package trainers

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

var errNotFound = errors.New("not found")

type Service struct {
	repo *Repository
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{repo: NewRepository(pool)}
}

func (s *Service) GetMyProfile(ctx context.Context, userID int64) (*Trainer, error) {
	t, err := s.repo.getByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, errNotFound
	}
	return t, nil
}

type PatchRequest struct {
	FirstName      *string `json:"first_name"`
	LastName       *string `json:"last_name"`
	Specialization *string `json:"specialization"`
}

func (s *Service) PatchMyProfile(ctx context.Context, userID int64, req PatchRequest) (*Trainer, error) {
	if err := s.repo.patch(ctx, userID, patchParams{
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		Specialization: req.Specialization,
	}); err != nil {
		return nil, err
	}
	return s.GetMyProfile(ctx, userID)
}
