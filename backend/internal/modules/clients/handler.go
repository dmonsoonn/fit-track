package clients

import (
	"errors"
	"log"
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
	tr := api.Group("/trainer", trainerMW)
	tr.Get("/clients", h.ListMyClients)
	tr.Get("/clients/:id", h.GetClient)

	// Client routes
	cl := api.Group("/clients/me", clientMW)
	cl.Get("", h.GetMyProfile)
	cl.Patch("", h.PatchMyProfile)
}

func (h *Handler) ListMyClients(c *fiber.Ctx) error {
	list, err := h.svc.ListMyClients(c.Context(), middleware.LocalUserID(c))
	if err != nil {
		return response.Internal(c)
	}
	return response.OK(c, list)
}

func (h *Handler) GetClient(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	cl, err := h.svc.GetClient(c.Context(), middleware.LocalUserID(c), id)
	if err != nil {
		switch {
		case errors.Is(err, errNotFound):
			return response.NotFound(c)
		case errors.Is(err, errForbidden):
			return response.Forbidden(c)
		default:
			return response.Internal(c)
		}
	}
	return response.OK(c, cl)
}

func (h *Handler) GetMyProfile(c *fiber.Ctx) error {
	cl, err := h.svc.GetMyProfile(c.Context(), middleware.LocalUserID(c))
	if err != nil {
		if errors.Is(err, errNotFound) {
			return response.NotFound(c)
		}
		return response.Internal(c)
	}
	return response.OK(c, cl)
}

func (h *Handler) PatchMyProfile(c *fiber.Ctx) error {
	var req PatchRequest
	if err := c.BodyParser(&req); err != nil {
		 log.Println("BodyParser error:", err)
		return response.BadRequest(c, "invalid body")
	}
	cl, err := h.svc.PatchMyProfile(c.Context(), middleware.LocalUserID(c), req)
	if err != nil {
		if errors.Is(err, errNotFound) {
			return response.NotFound(c)
		}
		return response.BadRequest(c, err.Error())
	}
	return response.OK(c, cl)
}
