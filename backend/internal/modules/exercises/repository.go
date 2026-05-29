package exercises

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Exercise struct {
	ExerciseID  int64   `json:"exercise_id"`
	TrainerID   *int64  `json:"trainer_id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	MuscleGroup *string `json:"muscle_group"`
	VideoKey    *string `json:"-"`
	VideoURL    *string `json:"video_url,omitempty"` // presigned, filled by service
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// listForTrainer returns system exercises (trainer_id IS NULL) plus the trainer's own exercises.
func (r *Repository) listForTrainer(ctx context.Context, trainerID *int64) ([]Exercise, error) {
	var rows pgx.Rows
	var err error
	if trainerID == nil {
		// admin or no trainer — return all
		rows, err = r.pool.Query(ctx,
			`SELECT exercise_id, trainer_id, name, description, muscle_group, video_url
			   FROM exercises ORDER BY name`)
	} else {
		rows, err = r.pool.Query(ctx,
			`SELECT exercise_id, trainer_id, name, description, muscle_group, video_url
			   FROM exercises WHERE trainer_id IS NULL OR trainer_id = $1
			  ORDER BY trainer_id NULLS FIRST, name`, *trainerID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Exercise
	for rows.Next() {
		e := Exercise{}
		if err := rows.Scan(&e.ExerciseID, &e.TrainerID, &e.Name, &e.Description, &e.MuscleGroup, &e.VideoKey); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, rows.Err()
}

func (r *Repository) getByID(ctx context.Context, id int64) (*Exercise, error) {
	e := &Exercise{}
	err := r.pool.QueryRow(ctx,
		`SELECT exercise_id, trainer_id, name, description, muscle_group, video_url
		   FROM exercises WHERE exercise_id = $1`, id,
	).Scan(&e.ExerciseID, &e.TrainerID, &e.Name, &e.Description, &e.MuscleGroup, &e.VideoKey)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return e, err
}

type createParams struct {
	TrainerID   *int64
	Name        string
	Description *string
	MuscleGroup *string
}

func (r *Repository) create(ctx context.Context, p createParams) (*Exercise, error) {
	e := &Exercise{}
	err := r.pool.QueryRow(ctx,
		`INSERT INTO exercises (trainer_id, name, description, muscle_group)
		 VALUES ($1, $2, $3, $4)
		 RETURNING exercise_id, trainer_id, name, description, muscle_group, video_url`,
		p.TrainerID, p.Name, p.Description, p.MuscleGroup,
	).Scan(&e.ExerciseID, &e.TrainerID, &e.Name, &e.Description, &e.MuscleGroup, &e.VideoKey)
	return e, err
}

type patchParams struct {
	Name        *string
	Description *string
	MuscleGroup *string
}

func (r *Repository) patch(ctx context.Context, id int64, p patchParams) (*Exercise, error) {
	if p.Name != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE exercises SET name=$1 WHERE exercise_id=$2", *p.Name, id); err != nil {
			return nil, err
		}
	}
	if p.Description != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE exercises SET description=$1 WHERE exercise_id=$2", *p.Description, id); err != nil {
			return nil, err
		}
	}
	if p.MuscleGroup != nil {
		if _, err := r.pool.Exec(ctx, "UPDATE exercises SET muscle_group=$1 WHERE exercise_id=$2", *p.MuscleGroup, id); err != nil {
			return nil, err
		}
	}
	return r.getByID(ctx, id)
}

func (r *Repository) setVideoKey(ctx context.Context, id int64, key string) error {
	_, err := r.pool.Exec(ctx, "UPDATE exercises SET video_url=$1 WHERE exercise_id=$2", key, id)
	return err
}

func (r *Repository) delete(ctx context.Context, id int64) error {
	tag, err := r.pool.Exec(ctx, "DELETE FROM exercises WHERE exercise_id=$1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
