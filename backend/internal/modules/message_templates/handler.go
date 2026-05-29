package message_templates

import (
	"errors"
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

func RegisterRoutes(api fiber.Router, pool *pgxpool.Pool, trainerMW fiber.Handler) {
	svc := NewService(pool)
	h := NewHandler(svc)

	api.Get("/message-templates", trainerMW, h.List)
	api.Post("/message-templates", trainerMW, h.Create)
	api.Delete("/message-templates/:id", trainerMW, h.Delete)
	api.Post("/message-templates/:id/send", trainerMW, h.Send)
}

func (h *Handler) List(c *fiber.Ctx) error {
	list, err := h.svc.List(c.Context(), middleware.LocalUserID(c))
	if err != nil {
		return response.Internal(c)
	}
	return response.OK(c, list)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var req CreateRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid body")
	}
	t, err := h.svc.Create(c.Context(), middleware.LocalUserID(c), middleware.LocalRole(c), req)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}
	return response.Created(c, t)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	if err := h.svc.Delete(c.Context(), id, middleware.LocalUserID(c), middleware.LocalRole(c)); err != nil {
		if errors.Is(err, errNotFound) {
			return response.NotFound(c)
		}
		return response.Internal(c)
	}
	return response.OK(c, fiber.Map{"deleted": true})
}

// Send dispatches a message template to a client as a notification.
// Body: { "client_user_id": 123 }
func (h *Handler) Send(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	var body struct {
		ClientUserID int64 `json:"client_user_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return response.BadRequest(c, "invalid body")
	}
	if err := h.svc.Send(c.Context(), id, body.ClientUserID); err != nil {
		if errors.Is(err, errNotFound) {
			return response.NotFound(c)
		}
		return response.Internal(c)
	}
	return response.OK(c, fiber.Map{"sent": true})
}
