package notifications

import (
	"strconv"

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

func RegisterRoutes(api fiber.Router, pool *pgxpool.Pool) {
	svc := NewService(pool)
	h := NewHandler(svc)

	api.Get("/notifications", h.List)
	api.Patch("/notifications/:id/read", h.MarkRead)
	api.Post("/notifications/read-all", h.MarkAllRead)
	api.Delete("/notifications/:id", h.Delete)
	api.Delete("/notifications", h.DeleteAll)
}

func (h *Handler) List(c *fiber.Ctx) error {
	list, err := h.svc.List(c.Context(), middleware.LocalUserID(c))
	if err != nil {
		return response.Internal(c)
	}
	return response.OK(c, list)
}

func (h *Handler) MarkRead(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	if err := h.svc.MarkRead(c.Context(), id, middleware.LocalUserID(c)); err != nil {
		return response.Internal(c)
	}
	return response.OK(c, fiber.Map{"read": true})
}

func (h *Handler) MarkAllRead(c *fiber.Ctx) error {
	if err := h.svc.MarkAllRead(c.Context(), middleware.LocalUserID(c)); err != nil {
		return response.Internal(c)
	}
	return response.OK(c, fiber.Map{"read": true})
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	if err := h.svc.Delete(c.Context(), id, middleware.LocalUserID(c)); err != nil {
		return response.Internal(c)
	}
	return response.OK(c, fiber.Map{"deleted": true})
}

func (h *Handler) DeleteAll(c *fiber.Ctx) error {
	if err := h.svc.DeleteAll(c.Context(), middleware.LocalUserID(c)); err != nil {
		return response.Internal(c)
	}
	return response.OK(c, fiber.Map{"deleted": true})
}
