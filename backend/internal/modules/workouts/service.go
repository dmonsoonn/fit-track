package workouts

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/fittrack/backend/internal/types"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	errNotFound     = errors.New("not found")
	errForbidden    = errors.New("forbidden")
	errBadStatus    = errors.New("workout is not in planned status")
	errInvalidInput = errors.New("invalid input")
)

type Service struct {
	repo *Repository
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{repo: NewRepository(pool), pool: pool}
}

func (s *Service) resolveTrainerID(ctx context.Context, userID int64) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, "SELECT trainer_id FROM trainers WHERE user_id=$1", userID).Scan(&id)
	return id, err
}

func (s *Service) resolveClientID(ctx context.Context, userID int64) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, "SELECT client_id FROM clients WHERE user_id=$1", userID).Scan(&id)
	return id, err
}

// getTrainerUserIDForWorkout resolves the trainer's user_id for a given workout.
func (s *Service) getTrainerUserIDForWorkout(ctx context.Context, workoutID int64) (int64, error) {
	var uid int64
	err := s.pool.QueryRow(ctx, `
		SELECT u.user_id
		  FROM workouts w
		  JOIN workout_plans p ON p.workout_plan_id = w.workout_plan_id
		  JOIN clients c ON c.client_id = p.client_id
		  JOIN trainers t ON t.trainer_id = c.trainer_id
		  JOIN users u ON u.user_id = t.user_id
		 WHERE w.workout_id = $1`, workoutID,
	).Scan(&uid)
	return uid, err
}

// planBelongsToTrainer checks trainer ownership via plan.
func (s *Service) planBelongsToTrainer(ctx context.Context, planID, trainerID int64) error {
	var tid int64
	err := s.pool.QueryRow(ctx, `
		SELECT c.trainer_id FROM workout_plans p
		JOIN clients c ON c.client_id = p.client_id
		WHERE p.workout_plan_id = $1`, planID,
	).Scan(&tid)
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

func (s *Service) ListByPlan(ctx context.Context, trainerUserID, planID int64) ([]Workout, error) {
	trainerID, err := s.resolveTrainerID(ctx, trainerUserID)
	if err != nil {
		return nil, err
	}
	if err := s.planBelongsToTrainer(ctx, planID, trainerID); err != nil {
		return nil, err
	}
	list, err := s.repo.listByPlan(ctx, planID)
	if err != nil {
		return nil, err
	}
	if list == nil {
		return []Workout{}, nil
	}
	return list, nil
}

func (s *Service) Get(ctx context.Context, workoutID int64) (*Workout, error) {
	w, err := s.repo.getByID(ctx, workoutID)
	if err != nil {
		return nil, err
	}
	if w == nil {
		return nil, errNotFound
	}
	return w, nil
}

func (s *Service) GetMySchedule(ctx context.Context, clientUserID int64) ([]Workout, error) {
	clientID, err := s.resolveClientID(ctx, clientUserID)
	if err != nil {
		return nil, err
	}
	list, err := s.repo.listForClient(ctx, clientID)
	if err != nil {
		return nil, err
	}
	if list == nil {
		return []Workout{}, nil
	}
	return list, nil
}

type CreateRequest struct {
	ScheduledDate   types.FlexTime `json:"scheduled_date"`
	DurationMinutes *int           `json:"duration_minutes"`
}

func (s *Service) Create(ctx context.Context, trainerUserID, planID int64, req CreateRequest) (*Workout, error) {
	if req.DurationMinutes != nil && *req.DurationMinutes <= 0 {
		return nil, fmt.Errorf("%w: duration must be greater than 0", errInvalidInput)
	}
	trainerID, err := s.resolveTrainerID(ctx, trainerUserID)
	if err != nil {
		return nil, err
	}
	if err := s.planBelongsToTrainer(ctx, planID, trainerID); err != nil {
		return nil, err
	}
	return s.repo.create(ctx, createParams{
		PlanID:          planID,
		ScheduledDate:   req.ScheduledDate.Time,
		DurationMinutes: req.DurationMinutes,
	})
}

type PatchRequest struct {
	ScheduledDate   *types.FlexTime `json:"scheduled_date"`
	DurationMinutes *int            `json:"duration_minutes"`
}

func (s *Service) Patch(ctx context.Context, trainerUserID, workoutID int64, req PatchRequest) (*Workout, error) {
	if req.DurationMinutes != nil && *req.DurationMinutes <= 0 {
		return nil, fmt.Errorf("%w: duration must be greater than 0", errInvalidInput)
	}
	w, err := s.repo.getByID(ctx, workoutID)
	if err != nil || w == nil {
		return nil, errNotFound
	}
	trainerID, err := s.resolveTrainerID(ctx, trainerUserID)
	if err != nil {
		return nil, err
	}
	if err := s.planBelongsToTrainer(ctx, w.WorkoutPlanID, trainerID); err != nil {
		return nil, err
	}
	var sd *time.Time
	if req.ScheduledDate != nil {
		t := req.ScheduledDate.Time
		sd = &t
	}
	return s.repo.patch(ctx, workoutID, patchParams{
		ScheduledDate:   sd,
		DurationMinutes: req.DurationMinutes,
	})
}

func (s *Service) Delete(ctx context.Context, trainerUserID, workoutID int64) error {
	w, err := s.repo.getByID(ctx, workoutID)
	if err != nil || w == nil {
		return errNotFound
	}
	trainerID, err := s.resolveTrainerID(ctx, trainerUserID)
	if err != nil {
		return err
	}
	if err := s.planBelongsToTrainer(ctx, w.WorkoutPlanID, trainerID); err != nil {
		return err
	}
	err = s.repo.delete(ctx, workoutID)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNotFound
	}
	return err
}

func (s *Service) Complete(ctx context.Context, clientUserID, workoutID int64) error {
	w, err := s.repo.getByID(ctx, workoutID)
	if err != nil || w == nil {
		return errNotFound
	}
	if w.Status != "planned" {
		return errBadStatus
	}
	// Verify this workout belongs to this client
	clientID, err := s.resolveClientID(ctx, clientUserID)
	if err != nil {
		return err
	}
	var cid int64
	err = s.pool.QueryRow(ctx, `
		SELECT p.client_id FROM workout_plans p WHERE p.workout_plan_id = $1`, w.WorkoutPlanID,
	).Scan(&cid)
	if err != nil || cid != clientID {
		return errForbidden
	}

	trainerUserID, err := s.getTrainerUserIDForWorkout(ctx, workoutID)
	if err != nil {
		return err
	}
	return s.repo.complete(ctx, workoutID, trainerUserID)
}
