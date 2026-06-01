package clients

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	errNotFound = errors.New("not found")
	errForbidden = errors.New("forbidden")
)

type Service struct {
	repo *Repository
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{repo: NewRepository(pool)}
}

func (s *Service) ListMyClients(ctx context.Context, trainerUserID int64) ([]Client, error) {
	// Resolve trainer_id from user_id
	var trainerID int64
	if err := s.repo.pool.QueryRow(ctx,
		"SELECT trainer_id FROM trainers WHERE user_id = $1", trainerUserID,
	).Scan(&trainerID); err != nil {
		return nil, err
	}

	list, err := s.repo.listByTrainer(ctx, trainerID)
	if err != nil {
		return nil, err
	}
	if list == nil {
		return []Client{}, nil
	}
	return list, nil
}

func (s *Service) GetClient(ctx context.Context, trainerUserID int64, clientID int64) (*Client, error) {
	// verify ownership
	var trainerID int64
	if err := s.repo.pool.QueryRow(ctx,
		"SELECT trainer_id FROM trainers WHERE user_id = $1", trainerUserID,
	).Scan(&trainerID); err != nil {
		return nil, err
	}

	cl, err := s.repo.getByClientID(ctx, clientID)
	if err != nil {
		return nil, err
	}
	if cl == nil {
		return nil, errNotFound
	}
	if cl.TrainerID != trainerID {
		return nil, errForbidden
	}
	return cl, nil
}

func (s *Service) GetMyProfile(ctx context.Context, userID int64) (*Client, error) {
	cl, err := s.repo.getByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if cl == nil {
		return nil, errNotFound
	}
	return cl, nil
}

type PatchRequest struct {
	FirstName   *string    `json:"first_name"`
	LastName    *string    `json:"last_name"`
	Goal        *string    `json:"goal"`
	Weight      *float64   `json:"weight"`
	Height      *float64   `json:"height"`
	Level       *string    `json:"level"`
	HealthNotes *string    `json:"health_notes"`
	DateOfBirth *time.Time `json:"date_of_birth"`
}

func (s *Service) PatchMyProfile(ctx context.Context, userID int64, req PatchRequest) (*Client, error) {
	if req.Weight != nil && *req.Weight <= 0 {
		return nil, errors.New("weight must be greater than 0")
	}
	if req.Height != nil && *req.Height <= 0 {
		return nil, errors.New("height must be greater than 0")
	}
	if req.Level != nil {
		switch *req.Level {
		case "beginner", "intermediate", "advanced":
		default:
			return nil, errors.New("invalid level")
		}
	}
	if err := s.repo.patchByUserID(ctx, userID, patchParams{
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		Goal:        req.Goal,
		Weight:      req.Weight,
		Height:      req.Height,
		Level:       req.Level,
		HealthNotes: req.HealthNotes,
		DateOfBirth: req.DateOfBirth,
	}); err != nil {
		return nil, err
	}
	return s.GetMyProfile(ctx, userID)
}
