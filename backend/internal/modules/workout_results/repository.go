package workout_results

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// WorkoutExercise represents a planned exercise in a workout.
type WorkoutExercise struct {
	WorkoutExerciseID int64    `json:"workout_exercise_id"`
	WorkoutID         int64    `json:"workout_id"`
	ExerciseID        int64    `json:"exercise_id"`
	ExerciseName      string   `json:"exercise_name"`
	Sets              int      `json:"sets"`
	Reps              int      `json:"reps"`
	Weight            *float64 `json:"weight"`
	Order             int      `json:"order"`
}

// WorkoutExerciseResult represents actual results for an exercise.
type WorkoutExerciseResult struct {
	ResultID           int64    `json:"result_id"`
	WorkoutID          int64    `json:"workout_id"`
	WorkoutExerciseID  int64    `json:"workout_exercise_id"`
	ActualSets         *int     `json:"actual_sets"`
	ActualReps         *int     `json:"actual_reps"`
	ActualWeight       *float64 `json:"actual_weight"`
	ClientComment      *string  `json:"client_comment"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) listExercises(ctx context.Context, workoutID int64) ([]WorkoutExercise, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT we.workout_exercise_id, we.workout_id, we.exercise_id, e.name,
		        we.sets, we.reps, we.weight, we."order"
		   FROM workout_exercises we
		   JOIN exercises e ON e.exercise_id = we.exercise_id
		  WHERE we.workout_id = $1
		  ORDER BY we."order"`, workoutID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []WorkoutExercise
	for rows.Next() {
		we := WorkoutExercise{}
		if err := rows.Scan(&we.WorkoutExerciseID, &we.WorkoutID, &we.ExerciseID, &we.ExerciseName,
			&we.Sets, &we.Reps, &we.Weight, &we.Order); err != nil {
			return nil, err
		}
		list = append(list, we)
	}
	return list, rows.Err()
}

type addExerciseParams struct {
	WorkoutID  int64
	ExerciseID int64
	Sets       int
	Reps       int
	Weight     *float64
	Order      int
}

func (r *Repository) addExercise(ctx context.Context, p addExerciseParams) (*WorkoutExercise, error) {
	we := &WorkoutExercise{}
	err := r.pool.QueryRow(ctx,
		`INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight, "order")
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING workout_exercise_id, workout_id, exercise_id, sets, reps, weight, "order"`,
		p.WorkoutID, p.ExerciseID, p.Sets, p.Reps, p.Weight, p.Order,
	).Scan(&we.WorkoutExerciseID, &we.WorkoutID, &we.ExerciseID, &we.Sets, &we.Reps, &we.Weight, &we.Order)
	return we, err
}

func (r *Repository) removeExercise(ctx context.Context, workoutID, workoutExerciseID int64) error {
	tag, err := r.pool.Exec(ctx,
		"DELETE FROM workout_exercises WHERE workout_id=$1 AND workout_exercise_id=$2",
		workoutID, workoutExerciseID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

type saveResultParams struct {
	WorkoutID          int64
	WorkoutExerciseID  int64
	ActualSets         *int
	ActualReps         *int
	ActualWeight       *float64
	ClientComment      *string
}

func (r *Repository) upsertResult(ctx context.Context, p saveResultParams) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO workout_exercise_results
		   (workout_id, workout_exercise_id, actual_sets, actual_reps, actual_weight, client_comment)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 ON CONFLICT (workout_id, workout_exercise_id)
		 DO UPDATE SET actual_sets=$3, actual_reps=$4, actual_weight=$5, client_comment=$6`,
		p.WorkoutID, p.WorkoutExerciseID, p.ActualSets, p.ActualReps, p.ActualWeight, p.ClientComment,
	)
	return err
}

func (r *Repository) listResults(ctx context.Context, workoutID int64) ([]WorkoutExerciseResult, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT result_id, workout_id, workout_exercise_id, actual_sets, actual_reps, actual_weight, client_comment
		   FROM workout_exercise_results WHERE workout_id=$1`, workoutID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []WorkoutExerciseResult
	for rows.Next() {
		res := WorkoutExerciseResult{}
		if err := rows.Scan(&res.ResultID, &res.WorkoutID, &res.WorkoutExerciseID,
			&res.ActualSets, &res.ActualReps, &res.ActualWeight, &res.ClientComment); err != nil {
			return nil, err
		}
		list = append(list, res)
	}
	return list, rows.Err()
}

func (r *Repository) workoutExists(ctx context.Context, workoutID int64) (bool, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM workouts WHERE workout_id=$1", workoutID).Scan(&count)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return count > 0, err
}
