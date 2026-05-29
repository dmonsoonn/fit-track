package exercises

import (
	"errors"
	"strconv"

	"github.com/fittrack/backend/internal/middleware"
	"github.com/fittrack/backend/internal/response"
	"github.com/fittrack/backend/internal/storage"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func RegisterRoutes(api fiber.Router, pool *pgxpool.Pool, s3 *storage.S3Client, trainerMW fiber.Handler) {
	svc := NewService(pool, s3)
	h := NewHandler(svc)

	api.Get("/exercises", h.List)
	api.Post("/exercises", trainerMW, h.Create)
	api.Get("/exercises/:id", h.Get)
	api.Patch("/exercises/:id", trainerMW, h.Patch)
	api.Delete("/exercises/:id", trainerMW, h.Delete)
	api.Post("/exercises/:id/video", trainerMW, h.UploadVideo)
}

func (h *Handler) Get(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	e, err := h.svc.GetByID(c.Context(), middleware.LocalUserID(c), middleware.LocalRole(c), id)
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
	return response.OK(c, e)
}

func (h *Handler) List(c *fiber.Ctx) error {
	list, err := h.svc.List(c.Context(), middleware.LocalUserID(c), middleware.LocalRole(c))
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
	e, err := h.svc.Create(c.Context(), middleware.LocalUserID(c), middleware.LocalRole(c), req)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}
	return response.Created(c, e)
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
	e, err := h.svc.Patch(c.Context(), middleware.LocalUserID(c), middleware.LocalRole(c), id, req)
	if err != nil {
		switch {
		case errors.Is(err, errNotFound):
			return response.NotFound(c)
		case errors.Is(err, errForbidden):
			return response.Forbidden(c)
		default:
			return response.BadRequest(c, err.Error())
		}
	}
	return response.OK(c, e)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}
	if err := h.svc.Delete(c.Context(), middleware.LocalUserID(c), middleware.LocalRole(c), id); err != nil {
		switch {
		case errors.Is(err, errNotFound):
			return response.NotFound(c)
		case errors.Is(err, errForbidden):
			return response.Forbidden(c)
		default:
			return response.Internal(c)
		}
	}
	return response.OK(c, fiber.Map{"deleted": true})
}

func (h *Handler) UploadVideo(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid id")
	}

	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "file field required")
	}

	f, err := file.Open()
	if err != nil {
		return response.Internal(c)
	}
	defer f.Close()

	if err := h.svc.UploadVideo(
		c.Context(), middleware.LocalUserID(c), middleware.LocalRole(c),
		id, file.Filename, f, file.Size,
	); err != nil {
		switch {
		case errors.Is(err, errNotFound):
			return response.NotFound(c)
		case errors.Is(err, errForbidden):
			return response.Forbidden(c)
		default:
			return response.Internal(c)
		}
	}
	return response.OK(c, fiber.Map{"uploaded": true})
}
