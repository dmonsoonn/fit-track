package workout_results

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

	api.Get("/workouts/:workoutId/exercises", h.ListExercises)
	api.Post("/workouts/:workoutId/exercises", trainerMW, h.AddExercise)
	api.Delete("/workouts/:workoutId/exercises/:exerciseId", trainerMW, h.RemoveExercise)
	api.Post("/workouts/:workoutId/results", clientMW, h.SaveResults)
	api.Get("/workouts/:workoutId/results", h.GetResults)
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

func (h *Handler) ListExercises(c *fiber.Ctx) error {
	wid, err := strconv.ParseInt(c.Params("workoutId"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid workoutId")
	}
	list, err := h.svc.ListExercises(c.Context(), wid)
	if err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, list)
}

func (h *Handler) AddExercise(c *fiber.Ctx) error {
	wid, err := strconv.ParseInt(c.Params("workoutId"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid workoutId")
	}
	var req AddExerciseRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid body")
	}
	we, err := h.svc.AddExercise(c.Context(), middleware.LocalUserID(c), wid, req)
	if err != nil {
		if errors.Is(err, errNotFound) || errors.Is(err, errForbidden) {
			return handleErr(c, err)
		}
		return response.BadRequest(c, err.Error())
	}
	return response.Created(c, we)
}

func (h *Handler) RemoveExercise(c *fiber.Ctx) error {
	wid, err := strconv.ParseInt(c.Params("workoutId"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid workoutId")
	}
	eid, err := strconv.ParseInt(c.Params("exerciseId"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid exerciseId")
	}
	if err := h.svc.RemoveExercise(c.Context(), middleware.LocalUserID(c), wid, eid); err != nil {
		return handleErr(c, err)
	}
	return response.OK(c, fiber.Map{"deleted": true})
}

func (h *Handler) SaveResults(c *fiber.Ctx) error {
	wid, err := strconv.ParseInt(c.Params("workoutId"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid workoutId")
	}
	var req struct {
		Results []ResultEntry `json:"results"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid body")
	}
	if len(req.Results) == 0 {
		return response.BadRequest(c, "results array is required")
	}
	if err := h.svc.SaveResults(c.Context(), wid, req.Results); err != nil {
		return response.Internal(c)
	}
	return response.Created(c, fiber.Map{"saved": true})
}

func (h *Handler) GetResults(c *fiber.Ctx) error {
	wid, err := strconv.ParseInt(c.Params("workoutId"), 10, 64)
	if err != nil {
		return response.BadRequest(c, "invalid workoutId")
	}
	list, err := h.svc.GetResults(c.Context(), wid)
	if err != nil {
		return response.Internal(c)
	}
	return response.OK(c, list)
}
