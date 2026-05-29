package workouts

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

func RegisterRoutes(api fiber.Router, pool *pgxpool.Pool, trainerMW, clientMW fiber.Handler) {
	svc := NewService(pool)
	h := NewHandler(svc)

	// Trainer routes
	api.Post("/plans/:planId/workouts", trainerMW, h.Create)
	api.Get("/plans/:planId/workouts", trainerMW, h.ListByPlan)
	api.Get("/workouts/:id", h.Get)
	api.Patch("/workouts/:id", trainerMW, h.Patch)
	api.Delete("/workouts/:id", trainerMW, h.Delete)

	// Client routes
	api.Post("/workouts/:id/complete", clientMW, h.Complete)
	api.Get("/clients/me/schedule", clientMW, h.GetMySchedule)
}

func handleErr(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, errNotFound):
		return response.NotFound(c)
	case errors.Is(err, errForbidden):
		return response.Forbidden(c)
	case errors.Is(err, errBadStatus):
		return response.BadRequest(c, "workout is not in planned status")
	default:
		return response.Internal(c)
	}
}

func (h *Handler) Create(c *fiber.Ctx) error {
	planID, err := strconv.ParseInt(c.Params("planId"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid planId")
	}
	var req CreateRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid body")
	}
	w, err := h.svc.Create(c.Context(), middleware.LocalUserID(c), planID, req)
	if err != nil {
		return handleErr(c, err)
	}
	return response.Created(c, w)
}

func (h *Handler) ListByPlan(c *fiber.Ctx) error {
	planID, err := strconv.ParseInt(c.Params("planId"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid planId")
	}
	list, err := h.svc.ListByPlan(c.Context(), middleware.LocalUserID(c), planID)
	if err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, list)
}

func (h *Handler) Get(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	w, err := h.svc.Get(c.Context(), id)
	if err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, w)
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
	w, err := h.svc.Patch(c.Context(), middleware.LocalUserID(c), id, req)
	if err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, w)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	if err := h.svc.Delete(c.Context(), middleware.LocalUserID(c), id); err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, fiber.Map{"deleted": true})
}

func (h *Handler) Complete(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	if err := h.svc.Complete(c.Context(), middleware.LocalUserID(c), id); err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, fiber.Map{"completed": true})
}

func (h *Handler) GetMySchedule(c *fiber.Ctx) error {
	list, err := h.svc.GetMySchedule(c.Context(), middleware.LocalUserID(c))
	if err != nil {
		return response.Internal(c)
	}
	return response.OK(c, list)
}
