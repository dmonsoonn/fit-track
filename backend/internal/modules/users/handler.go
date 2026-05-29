package users

import (
	"errors"
	"strconv"

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

func RegisterRoutes(api fiber.Router, pool *pgxpool.Pool, adminMW fiber.Handler) {
	svc := NewService(pool)
	h := NewHandler(svc)

	admin := api.Group("/admin", adminMW)
	admin.Get("/users", h.List)
	admin.Get("/users/:id", h.GetByID)
	admin.Patch("/users/:id", h.Patch)
	admin.Delete("/users/:id", h.Delete)
}

func (h *Handler) List(c *fiber.Ctx) error {
	users, err := h.svc.List(c.Context())
	if err != nil {
		return response.Internal(c)
	}
	return response.OK(c, users)
}

func (h *Handler) GetByID(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	u, err := h.svc.GetByID(c.Context(), id)
	if err != nil {
		if errors.Is(err, errNotFound) {
			return response.NotFound(c)
		}
		return response.Internal(c)
	}
	return response.OK(c, u)
}

func (h *Handler) Patch(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	var req PatchRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid body")
	}
	u, err := h.svc.Patch(c.Context(), id, req)
	if err != nil {
		if errors.Is(err, errNotFound) {
			return response.NotFound(c)
		}
		return response.BadRequest(c, err.Error())
	}
	return response.OK(c, u)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	if err := h.svc.Delete(c.Context(), id); err != nil {
		if errors.Is(err, errNotFound) {
			return response.NotFound(c)
		}
		return response.Internal(c)
	}
	return response.OK(c, fiber.Map{"deleted": true})
}
