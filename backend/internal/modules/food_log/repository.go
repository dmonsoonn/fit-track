package food_log

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type FoodLog struct {
	FoodLogID int64       `json:"food_log_id"`
	ClientID  int64       `json:"client_id"`
	Date      time.Time   `json:"date"`
	Entries   []FoodEntry `json:"entries"`
}

type FoodEntry struct {
	FoodEntryID int64      `json:"food_entry_id"`
	FoodLogID   int64      `json:"food_log_id"`
	Title       string     `json:"title"`
	Description *string    `json:"description"`
	Calories    *int       `json:"calories"`
	Protein     *float64   `json:"protein"`
	Fat         *float64   `json:"fat"`
	Carbs       *float64   `json:"carbs"`
	MealTime    *time.Time `json:"meal_time"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// upsertLog creates or retrieves a food_log for the given client and date.
func (r *Repository) upsertLog(ctx context.Context, clientID int64, date time.Time) (int64, error) {
	var id int64
	err := r.pool.QueryRow(ctx,
		`INSERT INTO food_logs (client_id, date)
		 VALUES ($1,$2)
		 ON CONFLICT (client_id, date) DO UPDATE SET date=EXCLUDED.date
		 RETURNING food_log_id`,
		clientID, date.Format("2006-01-02"),
	).Scan(&id)
	return id, err
}

func (r *Repository) listEntries(ctx context.Context, logID int64) ([]FoodEntry, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT food_entry_id, food_log_id, title, description,
		        calories, protein, fat, carbs, meal_time
		   FROM food_entries WHERE food_log_id=$1 ORDER BY meal_time NULLS LAST, food_entry_id`, logID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []FoodEntry
	for rows.Next() {
		e := FoodEntry{}
		if err := rows.Scan(&e.FoodEntryID, &e.FoodLogID, &e.Title, &e.Description,
			&e.Calories, &e.Protein, &e.Fat, &e.Carbs, &e.MealTime); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, rows.Err()
}

type createEntryParams struct {
	FoodLogID   int64
	Title       string
	Description *string
	Calories    *int
	Protein     *float64
	Fat         *float64
	Carbs       *float64
	MealTime    *time.Time
}

func (r *Repository) createEntry(ctx context.Context, p createEntryParams) (*FoodEntry, error) {
	e := &FoodEntry{}
	err := r.pool.QueryRow(ctx,
		`INSERT INTO food_entries (food_log_id, title, description, calories, protein, fat, carbs, meal_time)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 RETURNING food_entry_id, food_log_id, title, description, calories, protein, fat, carbs, meal_time`,
		p.FoodLogID, p.Title, p.Description, p.Calories, p.Protein, p.Fat, p.Carbs, p.MealTime,
	).Scan(&e.FoodEntryID, &e.FoodLogID, &e.Title, &e.Description,
		&e.Calories, &e.Protein, &e.Fat, &e.Carbs, &e.MealTime)
	return e, err
}

type patchEntryParams struct {
	Title       *string
	Description *string
	Calories    *int
	Protein     *float64
	Fat         *float64
	Carbs       *float64
	MealTime    *time.Time
}

func (r *Repository) patchEntry(ctx context.Context, entryID int64, p patchEntryParams) (*FoodEntry, error) {
	if p.Title != nil {
		r.pool.Exec(ctx, "UPDATE food_entries SET title=$1 WHERE food_entry_id=$2", *p.Title, entryID)
	}
	if p.Description != nil {
		r.pool.Exec(ctx, "UPDATE food_entries SET description=$1 WHERE food_entry_id=$2", *p.Description, entryID)
	}
	if p.Calories != nil {
		r.pool.Exec(ctx, "UPDATE food_entries SET calories=$1 WHERE food_entry_id=$2", *p.Calories, entryID)
	}
	if p.Protein != nil {
		r.pool.Exec(ctx, "UPDATE food_entries SET protein=$1 WHERE food_entry_id=$2", *p.Protein, entryID)
	}
	if p.Fat != nil {
		r.pool.Exec(ctx, "UPDATE food_entries SET fat=$1 WHERE food_entry_id=$2", *p.Fat, entryID)
	}
	if p.Carbs != nil {
		r.pool.Exec(ctx, "UPDATE food_entries SET carbs=$1 WHERE food_entry_id=$2", *p.Carbs, entryID)
	}
	if p.MealTime != nil {
		r.pool.Exec(ctx, "UPDATE food_entries SET meal_time=$1 WHERE food_entry_id=$2", *p.MealTime, entryID)
	}

	e := &FoodEntry{}
	err := r.pool.QueryRow(ctx,
		`SELECT food_entry_id, food_log_id, title, description, calories, protein, fat, carbs, meal_time
		   FROM food_entries WHERE food_entry_id=$1`, entryID,
	).Scan(&e.FoodEntryID, &e.FoodLogID, &e.Title, &e.Description,
		&e.Calories, &e.Protein, &e.Fat, &e.Carbs, &e.MealTime)
	return e, err
}

func (r *Repository) deleteEntry(ctx context.Context, entryID int64) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM food_entries WHERE food_entry_id=$1", entryID)
	return err
}

// clientIDForEntry returns the client_id that owns a given food_entry.
func (r *Repository) clientIDForEntry(ctx context.Context, entryID int64) (int64, error) {
	var cid int64
	err := r.pool.QueryRow(ctx,
		`SELECT l.client_id FROM food_entries e JOIN food_logs l ON l.food_log_id = e.food_log_id
		  WHERE e.food_entry_id=$1`, entryID,
	).Scan(&cid)
	return cid, err
}
