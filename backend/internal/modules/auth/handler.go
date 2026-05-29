package auth

import (
	"errors"

	"github.com/fittrack/backend/internal/config"
	"github.com/fittrack/backend/internal/response"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func RegisterRoutes(app *fiber.App, pool *pgxpool.Pool, cfg *config.Config) {
	repo := NewRepository(pool)
	svc := NewService(pool, repo, cfg)
	h := NewHandler(svc)

	app.Post("/api/v1/auth/register", h.Register)
	app.Post("/api/v1/auth/login", h.Login)
}

func (h *Handler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}

	user, err := h.svc.Register(c.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, errInvalidInput):
			return response.BadRequest(c, "missing or invalid fields")
		case errors.Is(err, errEmailTaken):
			return response.Conflict(c, "email already taken")
		case errors.Is(err, errInvalidInviteCode):
			return response.BadRequest(c, "invalid invite code")
		default:
			return response.Internal(c)
		}
	}

	return response.Created(c, user)
}

func (h *Handler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}

	token, err := h.svc.Login(c.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, errInvalidInput):
			return response.BadRequest(c, "email and password are required")
		case errors.Is(err, errBadCredentials):
			return response.Err(c, fiber.StatusUnauthorized, "invalid email or password")
		default:
			return response.Internal(c)
		}
	}

	return response.OK(c, token)
}
