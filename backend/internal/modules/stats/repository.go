package stats

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) getStats(ctx context.Context) (*StatsResponse, error) {
	resp := &StatsResponse{}

	// ── Metrics ──────────────────────────────────────────────────────────────

	// Total users + role breakdown
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*),
		        COUNT(*) FILTER (WHERE role = 'trainer'),
		        COUNT(*) FILTER (WHERE role = 'client')
		   FROM users`,
	).Scan(&resp.Metrics.TotalUsers, &resp.Metrics.Trainers, &resp.Metrics.Clients); err != nil {
		return nil, err
	}

	// Active workouts today vs same day last week
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FILTER (WHERE DATE(scheduled_date) = CURRENT_DATE),
		        COUNT(*) FILTER (WHERE DATE(scheduled_date) = CURRENT_DATE - 7)
		   FROM workouts WHERE status = 'planned'`,
	).Scan(&resp.Metrics.ActiveWorkoutsToday, &resp.Metrics.ActiveWorkoutsTodayPrev); err != nil {
		return nil, err
	}

	// Completed workouts: last 30d vs previous 30d
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '30 days'),
		        COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '60 days'
		                           AND completed_at <  NOW() - INTERVAL '30 days')
		   FROM workouts WHERE status = 'completed'`,
	).Scan(&resp.Metrics.CompletedLast30d, &resp.Metrics.CompletedPrev30d); err != nil {
		return nil, err
	}

	// New registrations: last 7d vs previous 7d
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'),
		        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days'
		                           AND created_at <  NOW() - INTERVAL '7 days')
		   FROM users`,
	).Scan(&resp.Metrics.NewRegistrations7d, &resp.Metrics.NewRegistrationsPrev7d); err != nil {
		return nil, err
	}

	// ── Activity chart ────────────────────────────────────────────────────────
	rows, err := r.pool.Query(ctx,
		`SELECT DATE(completed_at)::text, COUNT(*)
		   FROM workouts
		  WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '30 days'
		  GROUP BY DATE(completed_at)
		  ORDER BY 1`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var d DayCount
		if err := rows.Scan(&d.Date, &d.Count); err != nil {
			return nil, err
		}
		resp.ActivityChart = append(resp.ActivityChart, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if resp.ActivityChart == nil {
		resp.ActivityChart = []DayCount{}
	}

	// ── Goal distribution ─────────────────────────────────────────────────────
	rows2, err := r.pool.Query(ctx,
		`SELECT COALESCE(NULLIF(TRIM(goal), ''), 'Не указано'), COUNT(*)
		   FROM clients
		  GROUP BY 1`)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()
	for rows2.Next() {
		var g GoalCount
		if err := rows2.Scan(&g.Goal, &g.Count); err != nil {
			return nil, err
		}
		resp.GoalDistribution = append(resp.GoalDistribution, g)
	}
	if err := rows2.Err(); err != nil {
		return nil, err
	}
	if resp.GoalDistribution == nil {
		resp.GoalDistribution = []GoalCount{}
	}

	// ── Top 5 trainers ────────────────────────────────────────────────────────
	rows3, err := r.pool.Query(ctx,
		`SELECT u.first_name || ' ' || u.last_name,
		        COUNT(DISTINCT c.client_id),
		        COUNT(w.workout_id) FILTER (WHERE w.completed_at >= NOW() - INTERVAL '30 days'),
		        CASE WHEN COUNT(w.workout_id) > 0
		             THEN ROUND(
		               COUNT(w.workout_id) FILTER (WHERE w.status = 'completed')::numeric
		               / COUNT(w.workout_id) * 100, 1)
		             ELSE 0 END
		   FROM trainers t
		   JOIN users u ON u.user_id = t.user_id
		   LEFT JOIN clients c ON c.trainer_id = t.trainer_id
		   LEFT JOIN workout_plans p ON p.client_id = c.client_id
		   LEFT JOIN workouts w ON w.workout_plan_id = p.workout_plan_id
		  GROUP BY t.trainer_id, u.first_name, u.last_name
		  ORDER BY 3 DESC
		  LIMIT 5`)
	if err != nil {
		return nil, err
	}
	defer rows3.Close()
	for rows3.Next() {
		var t TrainerStat
		if err := rows3.Scan(&t.Name, &t.ClientCount, &t.MonthlySessions, &t.CompletionRate); err != nil {
			return nil, err
		}
		resp.TopTrainers = append(resp.TopTrainers, t)
	}
	if err := rows3.Err(); err != nil {
		return nil, err
	}
	if resp.TopTrainers == nil {
		resp.TopTrainers = []TrainerStat{}
	}

	// ── Recent registrations ─────────────────────────────────────────────────
	rows4, err := r.pool.Query(ctx,
		`SELECT user_id, first_name, last_name, role, is_active, created_at
		   FROM users
		  ORDER BY created_at DESC
		  LIMIT 10`)
	if err != nil {
		return nil, err
	}
	defer rows4.Close()
	for rows4.Next() {
		var u RecentUser
		if err := rows4.Scan(&u.UserID, &u.FirstName, &u.LastName, &u.Role, &u.IsActive, &u.CreatedAt); err != nil {
			return nil, err
		}
		resp.RecentRegistrations = append(resp.RecentRegistrations, u)
	}
	if err := rows4.Err(); err != nil {
		return nil, err
	}
	if resp.RecentRegistrations == nil {
		resp.RecentRegistrations = []RecentUser{}
	}

	return resp, nil
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Metrics struct {
	TotalUsers              int `json:"total_users"`
	Trainers                int `json:"trainers"`
	Clients                 int `json:"clients"`
	ActiveWorkoutsToday     int `json:"active_workouts_today"`
	ActiveWorkoutsTodayPrev int `json:"active_workouts_today_prev"`
	CompletedLast30d        int `json:"completed_last_30d"`
	CompletedPrev30d        int `json:"completed_prev_30d"`
	NewRegistrations7d      int `json:"new_registrations_7d"`
	NewRegistrationsPrev7d  int `json:"new_registrations_prev7d"`
}

type DayCount struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type GoalCount struct {
	Goal  string `json:"goal"`
	Count int    `json:"count"`
}

type TrainerStat struct {
	Name            string  `json:"name"`
	ClientCount     int     `json:"client_count"`
	MonthlySessions int     `json:"monthly_sessions"`
	CompletionRate  float64 `json:"completion_rate"`
}

type RecentUser struct {
	UserID    int64     `json:"user_id"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type StatsResponse struct {
	Metrics             Metrics       `json:"metrics"`
	ActivityChart       []DayCount    `json:"activity_chart"`
	GoalDistribution    []GoalCount   `json:"goal_distribution"`
	TopTrainers         []TrainerStat `json:"top_trainers"`
	RecentRegistrations []RecentUser  `json:"recent_registrations"`
}
