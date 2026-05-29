package workout_plans

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

	tr := api.Group("/trainer", trainerMW)
	tr.Get("/clients/:clientId/plans", h.List)
	tr.Get("/clients/:clientId/plans/:id", h.Get)
	tr.Post("/clients/:clientId/plans", h.Create)
	tr.Patch("/clients/:clientId/plans/:id", h.Patch)
	tr.Delete("/clients/:clientId/plans/:id", h.Delete)

	cl := api.Group("/clients/me", clientMW)
	cl.Get("/plans", h.GetMyActivePlan)
}

func parseClientID(c *fiber.Ctx) (int64, error) {
	return strconv.ParseInt(c.Params("clientId"), 10, 64)
}

func parsePlanID(c *fiber.Ctx) (int64, error) {
	return strconv.ParseInt(c.Params("id"), 10, 64)
}

func handleErr(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, errNotFound):
		return response.NotFound(c)
	case errors.Is(err, errForbidden):
		return response.Forbidden(c)
	default:
		return response.Internal(c)
	}
}

func (h *Handler) List(c *fiber.Ctx) error {
	clientID, err := parseClientID(c)
	if err != nil {
		return response.BadRequest(c, "invalid clientId")
	}
	list, err := h.svc.List(c.Context(), middleware.LocalUserID(c), clientID)
	if err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, list)
}

func (h *Handler) Get(c *fiber.Ctx) error {
	clientID, err := parseClientID(c)
	if err != nil {
		return response.BadRequest(c, "invalid clientId")
	}
	planID, err := parsePlanID(c)
	if err != nil {
		return response.BadRequest(c, "invalid plan id")
	}
	plan, err := h.svc.Get(c.Context(), middleware.LocalUserID(c), clientID, planID)
	if err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, plan)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	clientID, err := parseClientID(c)
	if err != nil {
		return response.BadRequest(c, "invalid clientId")
	}
	var req CreateRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid body")
	}
	plan, err := h.svc.Create(c.Context(), middleware.LocalUserID(c), clientID, req)
	if err != nil {
		if errors.Is(err, errNotFound) || errors.Is(err, errForbidden) {
			return handleErr(c, err)
		}
		return response.BadRequest(c, err.Error())
	}
	return response.Created(c, plan)
}

func (h *Handler) Patch(c *fiber.Ctx) error {
	clientID, err := parseClientID(c)
	if err != nil {
		return response.BadRequest(c, "invalid clientId")
	}
	planID, err := parsePlanID(c)
	if err != nil {
		return response.BadRequest(c, "invalid plan id")
	}
	var req PatchRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid body")
	}
	plan, err := h.svc.Patch(c.Context(), middleware.LocalUserID(c), clientID, planID, req)
	if err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, plan)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	clientID, err := parseClientID(c)
	if err != nil {
		return response.BadRequest(c, "invalid clientId")
	}
	planID, err := parsePlanID(c)
	if err != nil {
		return response.BadRequest(c, "invalid plan id")
	}
	if err := h.svc.Delete(c.Context(), middleware.LocalUserID(c), clientID, planID); err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, fiber.Map{"deleted": true})
}

func (h *Handler) GetMyActivePlan(c *fiber.Ctx) error {
	plan, err := h.svc.GetMyActivePlan(c.Context(), middleware.LocalUserID(c))
	if err != nil {
		if errors.Is(err, errNotFound) {
			return response.NotFound(c)
		}
		return response.Internal(c)
	}
	return response.OK(c, plan)
}
