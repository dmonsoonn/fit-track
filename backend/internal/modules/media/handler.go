package media

import (
	"fmt"
	"path/filepath"

	"github.com/fittrack/backend/internal/response"
	"github.com/fittrack/backend/internal/storage"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Handler struct {
	s3 *storage.S3Client
}

func NewHandler(s3 *storage.S3Client) *Handler {
	return &Handler{s3: s3}
}

func RegisterRoutes(api fiber.Router, s3 *storage.S3Client) {
	h := NewHandler(s3)
	api.Post("/media/upload", h.Upload)
}

func (h *Handler) Upload(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "file field required")
	}

	f, err := file.Open()
	if err != nil {
		return response.Internal(c)
	}
	defer f.Close()

	ext := filepath.Ext(file.Filename)
	key := fmt.Sprintf("uploads/%s%s", uuid.NewString(), ext)

	if err := h.s3.Upload(c.Context(), key, f, file.Size); err != nil {
		return response.Internal(c)
	}

	return response.OK(c, fiber.Map{"key": key})
}
