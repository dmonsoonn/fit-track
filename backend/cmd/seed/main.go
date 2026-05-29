// seed creates an admin user for development/testing.
// Usage: go run ./cmd/seed
package main

import (
	"context"
	"log"
	"strings"

	"github.com/fittrack/backend/internal/config"
	"github.com/fittrack/backend/internal/db"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	cfg := config.Load()
	pool := db.Connect(cfg)
	defer pool.Close()

	db.RunMigrations(context.Background(), pool)

	ctx := context.Background()

	adminEmail := strings.ToLower(cfg.SeedAdminEmail)
	adminPass := cfg.SeedAdminPassword

	if adminEmail == "" || adminPass == "" {
		log.Fatal("ADMIN_EMAIL and ADMIN_PASSWORD env vars are required for seeding")
	}

	// Check if admin already exists
	var count int
	if err := pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM users WHERE LOWER(email)=LOWER($1)", adminEmail,
	).Scan(&count); err != nil {
		log.Fatalf("query: %v", err)
	}
	if count > 0 {
		log.Printf("admin %s already exists, skipping", adminEmail)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(adminPass), 12)
	if err != nil {
		log.Fatalf("bcrypt: %v", err)
	}

	var userID int64
	if err := pool.QueryRow(ctx,
		`INSERT INTO users (email, first_name, last_name, password_hash, role)
		 VALUES ($1, 'Admin', 'User', $2, 'admin') RETURNING user_id`,
		adminEmail, string(hash),
	).Scan(&userID); err != nil {
		log.Fatalf("insert admin: %v", err)
	}

	log.Printf("admin created: email=%s user_id=%d", adminEmail, userID)
}
