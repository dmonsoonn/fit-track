package food_log

import (
	"context"
	"errors"
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

func (s *Service) resolveClientID(ctx context.Context, userID int64) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, "SELECT client_id FROM clients WHERE user_id=$1", userID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, errNotFound
	}
	return id, err
}

func (s *Service) resolveTrainerID(ctx context.Context, userID int64) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, "SELECT trainer_id FROM trainers WHERE user_id=$1", userID).Scan(&id)
	return id, err
}

func (s *Service) GetFoodLog(ctx context.Context, clientID int64, date time.Time) (*FoodLog, error) {
	logID, err := s.repo.upsertLog(ctx, clientID, date)
	if err != nil {
		return nil, err
	}
	entries, err := s.repo.listEntries(ctx, logID)
	if err != nil {
		return nil, err
	}
	if entries == nil {
		entries = []FoodEntry{}
	}
	return &FoodLog{
		FoodLogID: logID,
		ClientID:  clientID,
		Date:      date,
		Entries:   entries,
	}, nil
}

func (s *Service) GetMyFoodLog(ctx context.Context, clientUserID int64, date time.Time) (*FoodLog, error) {
	clientID, err := s.resolveClientID(ctx, clientUserID)
	if err != nil {
		return nil, err
	}
	return s.GetFoodLog(ctx, clientID, date)
}

func (s *Service) GetClientFoodLog(ctx context.Context, trainerUserID, clientID int64, date time.Time) (*FoodLog, error) {
	trainerID, err := s.resolveTrainerID(ctx, trainerUserID)
	if err != nil {
		return nil, err
	}
	// Verify trainer owns client
	var tid int64
	err = s.pool.QueryRow(ctx, "SELECT trainer_id FROM clients WHERE client_id=$1", clientID).Scan(&tid)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	if tid != trainerID {
		return nil, errForbidden
	}
	return s.GetFoodLog(ctx, clientID, date)
}

type AddEntryRequest struct {
	Title       string            `json:"title"`
	Description *string           `json:"description"`
	Calories    *int              `json:"calories"`
	Protein     *float64          `json:"protein"`
	Fat         *float64          `json:"fat"`
	Carbs       *float64          `json:"carbs"`
	MealTime    *types.FlexTime   `json:"meal_time"`
}

func (s *Service) AddEntry(ctx context.Context, clientUserID int64, date time.Time, req AddEntryRequest) (*FoodEntry, error) {
	if req.Title == "" {
		return nil, errors.New("title is required")
	}
	if req.Calories != nil && *req.Calories < 0 {
		return nil, errors.New("calories cannot be negative")
	}
	if req.Protein != nil && *req.Protein < 0 {
		return nil, errors.New("protein cannot be negative")
	}
	if req.Fat != nil && *req.Fat < 0 {
		return nil, errors.New("fat cannot be negative")
	}
	if req.Carbs != nil && *req.Carbs < 0 {
		return nil, errors.New("carbs cannot be negative")
	}
	clientID, err := s.resolveClientID(ctx, clientUserID)
	if err != nil {
		return nil, err
	}
	logID, err := s.repo.upsertLog(ctx, clientID, date)
	if err != nil {
		return nil, err
	}
	var mealTime *time.Time
	if req.MealTime != nil {
		t := req.MealTime.Time
		mealTime = &t
	}
	return s.repo.createEntry(ctx, createEntryParams{
		FoodLogID:   logID,
		Title:       req.Title,
		Description: req.Description,
		Calories:    req.Calories,
		Protein:     req.Protein,
		Fat:         req.Fat,
		Carbs:       req.Carbs,
		MealTime:    mealTime,
	})
}

type PatchEntryRequest struct {
	Title       *string           `json:"title"`
	Description *string           `json:"description"`
	Calories    *int              `json:"calories"`
	Protein     *float64          `json:"protein"`
	Fat         *float64          `json:"fat"`
	Carbs       *float64          `json:"carbs"`
	MealTime    *types.FlexTime   `json:"meal_time"`
}

func (s *Service) PatchEntry(ctx context.Context, clientUserID, entryID int64, req PatchEntryRequest) (*FoodEntry, error) {
	if req.Calories != nil && *req.Calories < 0 {
		return nil, errors.New("calories cannot be negative")
	}
	if req.Protein != nil && *req.Protein < 0 {
		return nil, errors.New("protein cannot be negative")
	}
	if req.Fat != nil && *req.Fat < 0 {
		return nil, errors.New("fat cannot be negative")
	}
	if req.Carbs != nil && *req.Carbs < 0 {
		return nil, errors.New("carbs cannot be negative")
	}
	clientID, err := s.resolveClientID(ctx, clientUserID)
	if err != nil {
		return nil, err
	}
	ownerID, err := s.repo.clientIDForEntry(ctx, entryID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	if ownerID != clientID {
		return nil, errForbidden
	}
	var mealTime *time.Time
	if req.MealTime != nil {
		t := req.MealTime.Time
		mealTime = &t
	}
	return s.repo.patchEntry(ctx, entryID, patchEntryParams{
		Title:       req.Title,
		Description: req.Description,
		Calories:    req.Calories,
		Protein:     req.Protein,
		Fat:         req.Fat,
		Carbs:       req.Carbs,
		MealTime:    mealTime,
	})
}

func (s *Service) DeleteEntry(ctx context.Context, clientUserID, entryID int64) error {
	clientID, err := s.resolveClientID(ctx, clientUserID)
	if err != nil {
		return err
	}
	ownerID, err := s.repo.clientIDForEntry(ctx, entryID)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNotFound
	}
	if err != nil {
		return err
	}
	if ownerID != clientID {
		return errForbidden
	}
	return s.repo.deleteEntry(ctx, entryID)
}
