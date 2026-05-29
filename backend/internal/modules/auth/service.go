package auth

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/fittrack/backend/internal/config"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var (
	errInvalidInput    = errors.New("invalid input")
	errEmailTaken      = errors.New("email already taken")
	errInvalidInviteCode = errors.New("invalid invite code")
	errBadCredentials  = errors.New("invalid email or password")
)

type Service struct {
	repo *Repository
	pool *pgxpool.Pool
	cfg  *config.Config
}

func NewService(pool *pgxpool.Pool, repo *Repository, cfg *config.Config) *Service {
	return &Service{repo: repo, pool: pool, cfg: cfg}
}

type RegisterRequest struct {
	Email      string `json:"email"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	Password   string `json:"password"`
	Role       string `json:"role"`
	InviteCode string `json:"invite_code"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UserResponse struct {
	UserID    int64     `json:"user_id"`
	Email     string    `json:"email"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	IsActive  bool      `json:"is_active"`
}

type TokenResponse struct {
	Token string `json:"token"`
}

func (s *Service) Register(ctx context.Context, req RegisterRequest) (*UserResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		return nil, errInvalidInput
	}
	if req.Role != "trainer" && req.Role != "client" {
		return nil, errInvalidInput
	}
	if req.Role == "client" && strings.TrimSpace(req.InviteCode) == "" {
		return nil, errInvalidInput
	}

	exists, err := s.repo.emailExists(ctx, email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, err
	}

	// Resolve trainer for client registrations before opening the transaction
	var trainerID int64
	if req.Role == "client" {
		trainerID, err = s.repo.getTrainerIDByInviteCode(ctx, strings.TrimSpace(req.InviteCode))
		if err != nil {
			return nil, err
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	userID, err := s.repo.createUserTx(ctx, tx, createUserParams{
		Email:        email,
		FirstName:    strings.TrimSpace(req.FirstName),
		LastName:     strings.TrimSpace(req.LastName),
		PasswordHash: string(hash),
		Role:         req.Role,
	})
	if err != nil {
		return nil, err
	}

	switch req.Role {
	case "trainer":
		if err := s.repo.createTrainerTx(ctx, tx, userID, generateInviteCode()); err != nil {
			return nil, err
		}
	case "client":
		if err := s.repo.createClientTx(ctx, tx, userID, trainerID); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &UserResponse{
		UserID:    userID,
		Email:     email,
		FirstName: strings.TrimSpace(req.FirstName),
		LastName:  strings.TrimSpace(req.LastName),
		Role:      req.Role,
		CreatedAt: time.Now(),
		IsActive:  true,
	}, nil
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (*TokenResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Password == "" {
		return nil, errInvalidInput
	}

	user, err := s.repo.getUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errBadCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errBadCredentials
	}

	exp := time.Now().Add(time.Duration(s.cfg.JWTExpireHours) * time.Hour)
	claims := jwt.MapClaims{
		"user_id": user.UserID,
		"role":    user.Role,
		"exp":     exp.Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, err
	}

	return &TokenResponse{Token: signed}, nil
}
