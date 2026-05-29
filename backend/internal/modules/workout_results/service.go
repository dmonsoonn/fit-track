package workout_results

import (
	"context"
	"errors"

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

func (s *Service) resolveTrainerID(ctx context.Context, userID int64) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, "SELECT trainer_id FROM trainers WHERE user_id=$1", userID).Scan(&id)
	return id, err
}

func (s *Service) workoutBelongsToTrainer(ctx context.Context, workoutID, trainerID int64) error {
	var tid int64
	err := s.pool.QueryRow(ctx, `
		SELECT c.trainer_id
		  FROM workouts w
		  JOIN workout_plans p ON p.workout_plan_id = w.workout_plan_id
		  JOIN clients c ON c.client_id = p.client_id
		 WHERE w.workout_id=$1`, workoutID,
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

func (s *Service) ListExercises(ctx context.Context, workoutID int64) ([]WorkoutExercise, error) {
	exists, err := s.repo.workoutExists(ctx, workoutID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, errNotFound
	}
	list, err := s.repo.listExercises(ctx, workoutID)
	if err != nil {
		return nil, err
	}
	if list == nil {
		return []WorkoutExercise{}, nil
	}
	return list, nil
}

type AddExerciseRequest struct {
	ExerciseID int64    `json:"exercise_id"`
	Sets       int      `json:"sets"`
	Reps       int      `json:"reps"`
	Weight     *float64 `json:"weight"`
	Order      int      `json:"order"`
}

func (s *Service) AddExercise(ctx context.Context, trainerUserID, workoutID int64, req AddExerciseRequest) (*WorkoutExercise, error) {
	trainerID, err := s.resolveTrainerID(ctx, trainerUserID)
	if err != nil {
		return nil, err
	}
	if err := s.workoutBelongsToTrainer(ctx, workoutID, trainerID); err != nil {
		return nil, err
	}
	if req.Sets <= 0 || req.Reps <= 0 {
		return nil, errors.New("sets and reps must be positive")
	}
	return s.repo.addExercise(ctx, addExerciseParams{
		WorkoutID:  workoutID,
		ExerciseID: req.ExerciseID,
		Sets:       req.Sets,
		Reps:       req.Reps,
		Weight:     req.Weight,
		Order:      req.Order,
	})
}

func (s *Service) RemoveExercise(ctx context.Context, trainerUserID, workoutID, workoutExerciseID int64) error {
	trainerID, err := s.resolveTrainerID(ctx, trainerUserID)
	if err != nil {
		return err
	}
	if err := s.workoutBelongsToTrainer(ctx, workoutID, trainerID); err != nil {
		return err
	}
	err = s.repo.removeExercise(ctx, workoutID, workoutExerciseID)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNotFound
	}
	return err
}

type ResultEntry struct {
	WorkoutExerciseID int64    `json:"workout_exercise_id"`
	ActualSets        *int     `json:"actual_sets"`
	ActualReps        *int     `json:"actual_reps"`
	ActualWeight      *float64 `json:"actual_weight"`
	ClientComment     *string  `json:"client_comment"`
}

func (s *Service) SaveResults(ctx context.Context, workoutID int64, entries []ResultEntry) error {
	for _, e := range entries {
		if err := s.repo.upsertResult(ctx, saveResultParams{
			WorkoutID:         workoutID,
			WorkoutExerciseID: e.WorkoutExerciseID,
			ActualSets:        e.ActualSets,
			ActualReps:        e.ActualReps,
			ActualWeight:      e.ActualWeight,
			ClientComment:     e.ClientComment,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) GetResults(ctx context.Context, workoutID int64) ([]WorkoutExerciseResult, error) {
	list, err := s.repo.listResults(ctx, workoutID)
	if err != nil {
		return nil, err
	}
	if list == nil {
		return []WorkoutExerciseResult{}, nil
	}
	return list, nil
}
