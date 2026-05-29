package users

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errNotFound = errors.New("not found")

type Service struct {
	repo *Repository
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{repo: NewRepository(pool)}
}

func (s *Service) List(ctx context.Context) ([]User, error) {
	users, err := s.repo.list(ctx)
	if err != nil {
		return nil, err
	}
	if users == nil {
		return []User{}, nil
	}
	return users, nil
}

func (s *Service) GetByID(ctx context.Context, id int64) (*User, error) {
	u, err := s.repo.getByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, errNotFound
	}
	return u, nil
}

type PatchRequest struct {
	Role     *string `json:"role"`
	IsActive *bool   `json:"is_active"`
}

func (s *Service) Patch(ctx context.Context, id int64, req PatchRequest) (*User, error) {
	if req.Role != nil {
		switch *req.Role {
		case "admin", "trainer", "client":
		default:
			return nil, errors.New("invalid role")
		}
	}
	u, err := s.repo.patch(ctx, id, patchParams{Role: req.Role, IsActive: req.IsActive})
	if errors.Is(err, pgx.ErrNoRows) || u == nil {
		return nil, errNotFound
	}
	return u, err
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	err := s.repo.delete(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNotFound
	}
	return err
}
