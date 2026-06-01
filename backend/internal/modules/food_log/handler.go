package food_log

import (
	"errors"
	"strconv"
	"time"

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

	cl := api.Group("/clients/me", clientMW)
	cl.Get("/food-logs/:date", h.GetMyFoodLog)
	cl.Post("/food-logs/:date/entries", h.AddEntry)
	cl.Patch("/food-logs/entries/:id", h.PatchEntry)
	cl.Delete("/food-logs/entries/:id", h.DeleteEntry)

	tr := api.Group("/trainer", trainerMW)
	tr.Get("/clients/:id/food-logs/:date", h.GetClientFoodLog)
}

func parseDate(c *fiber.Ctx) (time.Time, error) {
	return time.Parse("2006-01-02", c.Params("date"))
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

func (h *Handler) GetMyFoodLog(c *fiber.Ctx) error {
	date, err := parseDate(c)
	if err != nil {
		return response.BadRequest(c, "invalid date format, use YYYY-MM-DD")
	}
	log, err := h.svc.GetMyFoodLog(c.Context(), middleware.LocalUserID(c), date)
	if err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, log)
}

func (h *Handler) AddEntry(c *fiber.Ctx) error {
	date, err := parseDate(c)
	if err != nil {
		return response.BadRequest(c, "invalid date format, use YYYY-MM-DD")
	}
	var req AddEntryRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid body")
	}
	entry, err := h.svc.AddEntry(c.Context(), middleware.LocalUserID(c), date, req)
	if err != nil {
		if errors.Is(err, errNotFound) || errors.Is(err, errForbidden) {
			return handleErr(c, err)
		}
		return response.BadRequest(c, err.Error())
	}
	return response.Created(c, entry)
}

func (h *Handler) PatchEntry(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	var req PatchEntryRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid body")
	}
	entry, err := h.svc.PatchEntry(c.Context(), middleware.LocalUserID(c), id, req)
	if err != nil {
		if errors.Is(err, errNotFound) || errors.Is(err, errForbidden) {
			return handleErr(c, err)
		}
		return response.BadRequest(c, err.Error())
	}
	return response.OK(c, entry)
}

func (h *Handler) DeleteEntry(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	if err := h.svc.DeleteEntry(c.Context(), middleware.LocalUserID(c), id); err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, fiber.Map{"deleted": true})
}

func (h *Handler) GetClientFoodLog(c *fiber.Ctx) error {
	clientID, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid client id")
	}
	date, err := parseDate(c)
	if err != nil {
		return response.BadRequest(c, "invalid date format, use YYYY-MM-DD")
	}
	log, err := h.svc.GetClientFoodLog(c.Context(), middleware.LocalUserID(c), clientID, date)
	if err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, log)
}
