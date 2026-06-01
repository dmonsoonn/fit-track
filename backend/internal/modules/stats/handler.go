package stats

import (
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
	admin.Get("/stats", h.GetStats)
}

func (h *Handler) GetStats(c *fiber.Ctx) error {
	stats, err := h.svc.GetStats(c.Context())
	if err != nil {
		return response.Internal(c)
	}
	return response.OK(c, stats)
}
