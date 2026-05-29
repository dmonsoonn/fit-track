package exercises

import (
	"context"
	"errors"
	"fmt"
	"io"
	"path/filepath"

	"github.com/fittrack/backend/internal/storage"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	errNotFound  = errors.New("not found")
	errForbidden = errors.New("forbidden")
)

type Service struct {
	repo *Repository
	s3   *storage.S3Client
}

func NewService(pool *pgxpool.Pool, s3 *storage.S3Client) *Service {
	return &Service{repo: NewRepository(pool), s3: s3}
}

func (s *Service) fillPresignedURL(ctx context.Context, e *Exercise) {
	if e.VideoKey != nil && *e.VideoKey != "" {
		url, err := s.s3.PresignGet(ctx, *e.VideoKey)
		if err == nil {
			e.VideoURL = &url
		}
	}
}

// trainerIDForUser resolves trainer_id from user_id (nil if admin with no trainer profile).
func (s *Service) trainerIDForUser(ctx context.Context, userID int64, role string) (*int64, error) {
	if role == "admin" {
		return nil, nil
	}
	var tid int64
	err := s.repo.pool.QueryRow(ctx,
		"SELECT trainer_id FROM trainers WHERE user_id=$1", userID,
	).Scan(&tid)
	if err != nil {
		return nil, err
	}
	return &tid, nil
}

func (s *Service) GetByID(ctx context.Context, userID int64, role string, exerciseID int64) (*Exercise, error) {
	e, err := s.repo.getByID(ctx, exerciseID)
	if err != nil {
		return nil, err
	}
	if e == nil {
		return nil, errNotFound
	}
	s.fillPresignedURL(ctx, e)
	return e, nil
}

func (s *Service) List(ctx context.Context, userID int64, role string) ([]Exercise, error) {
	trainerID, err := s.trainerIDForUser(ctx, userID, role)
	if err != nil {
		return nil, err
	}
	list, err := s.repo.listForTrainer(ctx, trainerID)
	if err != nil {
		return nil, err
	}
	if list == nil {
		return []Exercise{}, nil
	}
	for i := range list {
		s.fillPresignedURL(ctx, &list[i])
	}
	return list, nil
}

type CreateRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	MuscleGroup *string `json:"muscle_group"`
}

func (s *Service) Create(ctx context.Context, userID int64, role string, req CreateRequest) (*Exercise, error) {
	if req.Name == "" {
		return nil, errors.New("name is required")
	}
	trainerID, err := s.trainerIDForUser(ctx, userID, role)
	if err != nil {
		return nil, err
	}
	e, err := s.repo.create(ctx, createParams{
		TrainerID:   trainerID,
		Name:        req.Name,
		Description: req.Description,
		MuscleGroup: req.MuscleGroup,
	})
	if err != nil {
		return nil, err
	}
	return e, nil
}

type PatchRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	MuscleGroup *string `json:"muscle_group"`
}

func (s *Service) Patch(ctx context.Context, userID int64, role string, exerciseID int64, req PatchRequest) (*Exercise, error) {
	e, err := s.repo.getByID(ctx, exerciseID)
	if err != nil {
		return nil, err
	}
	if e == nil {
		return nil, errNotFound
	}
	if !s.canModify(ctx, userID, role, e) {
		return nil, errForbidden
	}
	updated, err := s.repo.patch(ctx, exerciseID, patchParams{
		Name:        req.Name,
		Description: req.Description,
		MuscleGroup: req.MuscleGroup,
	})
	if err != nil {
		return nil, err
	}
	s.fillPresignedURL(ctx, updated)
	return updated, nil
}

func (s *Service) Delete(ctx context.Context, userID int64, role string, exerciseID int64) error {
	e, err := s.repo.getByID(ctx, exerciseID)
	if err != nil {
		return err
	}
	if e == nil {
		return errNotFound
	}
	if !s.canModify(ctx, userID, role, e) {
		return errForbidden
	}
	err = s.repo.delete(ctx, exerciseID)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNotFound
	}
	return err
}

func (s *Service) UploadVideo(ctx context.Context, userID int64, role string, exerciseID int64, filename string, body io.Reader, size int64) error {
	e, err := s.repo.getByID(ctx, exerciseID)
	if err != nil {
		return err
	}
	if e == nil {
		return errNotFound
	}
	if !s.canModify(ctx, userID, role, e) {
		return errForbidden
	}

	ext := filepath.Ext(filename)
	key := fmt.Sprintf("exercises/%d%s", exerciseID, ext)
	if err := s.s3.Upload(ctx, key, body, size); err != nil {
		return err
	}
	return s.repo.setVideoKey(ctx, exerciseID, key)
}

// canModify returns true if user is admin OR the exercise belongs to this trainer.
func (s *Service) canModify(ctx context.Context, userID int64, role string, e *Exercise) bool {
	if role == "admin" {
		return true
	}
	if e.TrainerID == nil {
		return false // system exercise, only admin
	}
	var tid int64
	if err := s.repo.pool.QueryRow(ctx,
		"SELECT trainer_id FROM trainers WHERE user_id=$1", userID,
	).Scan(&tid); err != nil {
		return false
	}
	return *e.TrainerID == tid
}
