package trainers

import (
	"errors"

	"github.com/fittrack/backend/internal/middleware"
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

func RegisterRoutes(api fiber.Router, pool *pgxpool.Pool, trainerMW fiber.Handler) {
	svc := NewService(pool)
	h := NewHandler(svc)

	r := api.Group("/trainers/me", trainerMW)
	r.Get("", h.GetMyProfile)
	r.Patch("", h.PatchMyProfile)
	r.Get("/invite-code", h.GetInviteCode)
}

func (h *Handler) GetMyProfile(c *fiber.Ctx) error {
	t, err := h.svc.GetMyProfile(c.Context(), middleware.LocalUserID(c))
	if err != nil {
		if errors.Is(err, errNotFound) {
			return response.NotFound(c)
		}
		return response.Internal(c)
	}
	return response.OK(c, t)
}

func (h *Handler) PatchMyProfile(c *fiber.Ctx) error {
	var req PatchRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid body")
	}
	t, err := h.svc.PatchMyProfile(c.Context(), middleware.LocalUserID(c), req)
	if err != nil {
		if errors.Is(err, errNotFound) {
			return response.NotFound(c)
		}
		return response.Internal(c)
	}
	return response.OK(c, t)
}

func (h *Handler) GetInviteCode(c *fiber.Ctx) error {
	t, err := h.svc.GetMyProfile(c.Context(), middleware.LocalUserID(c))
	if err != nil {
		if errors.Is(err, errNotFound) {
			return response.NotFound(c)
		}
		return response.Internal(c)
	}
	return response.OK(c, fiber.Map{"invite_code": t.InviteCode})
}
