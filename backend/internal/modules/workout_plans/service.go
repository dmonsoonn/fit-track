package workout_plans

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/fittrack/backend/internal/types"
	"github.com/jackc/pgx/v5"
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

// resolveTrainerID returns the trainer_id for a trainer user.
func (s *Service) resolveTrainerID(ctx context.Context, userID int64) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, "SELECT trainer_id FROM trainers WHERE user_id=$1", userID).Scan(&id)
	return id, err
}

// verifyTrainerOwnsClient checks that the client belongs to this trainer.
func (s *Service) verifyTrainerOwnsClient(ctx context.Context, trainerID, clientID int64) error {
	var tid int64
	err := s.pool.QueryRow(ctx, "SELECT trainer_id FROM clients WHERE client_id=$1", clientID).Scan(&tid)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNotFound
	}
	if err != nil {
		return err
	}
	if tid != trainerID {
		return errForbidden
	}
	return nil
}

// resolveClientID returns the client_id for a client user.
func (s *Service) resolveClientID(ctx context.Context, userID int64) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, "SELECT client_id FROM clients WHERE user_id=$1", userID).Scan(&id)
	return id, err
}

func (s *Service) List(ctx context.Context, trainerUserID, clientID int64) ([]WorkoutPlan, error) {
	trainerID, err := s.resolveTrainerID(ctx, trainerUserID)
	if err != nil {
		return nil, err
	}
	if err := s.verifyTrainerOwnsClient(ctx, trainerID, clientID); err != nil {
		return nil, err
	}
	list, err := s.repo.listByClient(ctx, clientID)
	if err != nil {
		return nil, err
	}
	if list == nil {
		return []WorkoutPlan{}, nil
	}
	return list, nil
}

func (s *Service) Get(ctx context.Context, trainerUserID, clientID, planID int64) (*WorkoutPlan, error) {
	trainerID, err := s.resolveTrainerID(ctx, trainerUserID)
	if err != nil {
		return nil, err
	}
	if err := s.verifyTrainerOwnsClient(ctx, trainerID, clientID); err != nil {
		return nil, err
	}
	plan, err := s.repo.getByID(ctx, planID)
	if err != nil {
		return nil, err
	}
	if plan == nil || plan.ClientID != clientID {
		return nil, errNotFound
	}
	return plan, nil
}

type CreateRequest struct {
	Title       string            `json:"title"`
	Description *string           `json:"description"`
	IsActive    bool              `json:"is_active"`
	EndDate     *types.FlexTime   `json:"end_date"`
}

func (s *Service) Create(ctx context.Context, trainerUserID, clientID int64, req CreateRequest) (*WorkoutPlan, error) {
	if req.Title == "" {
		return nil, errors.New("title is required")
	}
	trainerID, err := s.resolveTrainerID(ctx, trainerUserID)
	if err != nil {
		return nil, err
	}
	if err := s.verifyTrainerOwnsClient(ctx, trainerID, clientID); err != nil {
		return nil, err
	}
	// If the new plan is active, deactivate any existing active plan for the client first.
	if req.IsActive {
		if _, err := s.pool.Exec(ctx,
			"UPDATE workout_plans SET is_active=FALSE WHERE client_id=$1 AND is_active=TRUE",
			clientID,
		); err != nil {
			return nil, err
		}
	}
	var endDate *time.Time
	if req.EndDate != nil {
		t := req.EndDate.Time
		endDate = &t
	}
	return s.repo.create(ctx, createParams{
		ClientID:    clientID,
		Title:       req.Title,
		Description: req.Description,
		IsActive:    req.IsActive,
		EndDate:     endDate,
	})
}

type PatchRequest struct {
	Title       *string           `json:"title"`
	Description *string           `json:"description"`
	IsActive    *bool             `json:"is_active"`
	EndDate     *types.FlexTime   `json:"end_date"`
}

func (s *Service) Patch(ctx context.Context, trainerUserID, clientID, planID int64, req PatchRequest) (*WorkoutPlan, error) {
	if req.Title != nil && strings.TrimSpace(*req.Title) == "" {
		return nil, errors.New("title cannot be blank")
	}
	trainerID, err := s.resolveTrainerID(ctx, trainerUserID)
	if err != nil {
		return nil, err
	}
	if err := s.verifyTrainerOwnsClient(ctx, trainerID, clientID); err != nil {
		return nil, err
	}
	plan, err := s.repo.getByID(ctx, planID)
	if err != nil || plan == nil || plan.ClientID != clientID {
		return nil, errNotFound
	}
	var endDate *time.Time
	if req.EndDate != nil {
		t := req.EndDate.Time
		endDate = &t
	}
	return s.repo.patch(ctx, planID, patchParams{
		Title:       req.Title,
		Description: req.Description,
		IsActive:    req.IsActive,
		EndDate:     endDate,
	})
}

func (s *Service) Delete(ctx context.Context, trainerUserID, clientID, planID int64) error {
	trainerID, err := s.resolveTrainerID(ctx, trainerUserID)
	if err != nil {
		return err
	}
	if err := s.verifyTrainerOwnsClient(ctx, trainerID, clientID); err != nil {
		return err
	}
	plan, err := s.repo.getByID(ctx, planID)
	if err != nil || plan == nil || plan.ClientID != clientID {
		return errNotFound
	}
	err = s.repo.delete(ctx, planID)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNotFound
	}
	return err
}

func (s *Service) GetMyActivePlan(ctx context.Context, clientUserID int64) (*WorkoutPlan, error) {
	clientID, err := s.resolveClientID(ctx, clientUserID)
	if err != nil {
		return nil, errNotFound
	}
	plan, err := s.repo.getActivePlanByClient(ctx, clientID)
	if err != nil {
		return nil, err
	}
	if plan == nil {
		return nil, errNotFound
	}
	return plan, nil
}
