package db

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"sort"
	"strings"

	"github.com/fittrack/backend/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

func Connect(cfg *config.Config) *pgxpool.Pool {
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("unable to create connection pool: %v", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("unable to ping database: %v", err)
	}
	log.Println("connected to database")
	return pool
}

func RunMigrations(ctx context.Context, pool *pgxpool.Pool) {
	// ensure tracking table exists
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    INTEGER PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`); err != nil {
		log.Fatalf("create schema_migrations: %v", err)
	}

	entries, err := fs.ReadDir(migrationsFS, "migrations")
	if err != nil {
		log.Fatalf("read migrations dir: %v", err)
	}

	// collect and sort up-migration files
	var upFiles []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".up.sql") {
			upFiles = append(upFiles, e.Name())
		}
	}
	sort.Strings(upFiles)

	for _, name := range upFiles {
		var version int
		fmt.Sscanf(name, "%d_", &version)

		var count int
		if err := pool.QueryRow(ctx,
			"SELECT COUNT(*) FROM schema_migrations WHERE version = $1", version,
		).Scan(&count); err != nil {
			log.Fatalf("check migration %d: %v", version, err)
		}
		if count > 0 {
			continue
		}

		content, _ := fs.ReadFile(migrationsFS, "migrations/"+name)

		tx, err := pool.Begin(ctx)
		if err != nil {
			log.Fatalf("begin tx for migration %d: %v", version, err)
		}
		if _, err := tx.Exec(ctx, string(content)); err != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("apply migration %s: %v", name, err)
		}
		if _, err := tx.Exec(ctx,
			"INSERT INTO schema_migrations (version) VALUES ($1)", version,
		); err != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("record migration %d: %v", version, err)
		}
		if err := tx.Commit(ctx); err != nil {
			log.Fatalf("commit migration %d: %v", version, err)
		}
		log.Printf("applied migration %s", name)
	}
}
