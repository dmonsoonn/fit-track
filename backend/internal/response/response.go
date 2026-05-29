package response

import "github.com/gofiber/fiber/v2"

type envelope struct {
	Data  any `json:"data"`
	Error any `json:"error"`
}

func OK(c *fiber.Ctx, data any) error {
	return c.JSON(envelope{Data: data, Error: nil})
}

func Created(c *fiber.Ctx, data any) error {
	return c.Status(fiber.StatusCreated).JSON(envelope{Data: data, Error: nil})
}

func Err(c *fiber.Ctx, status int, msg string) error {
	return c.Status(status).JSON(envelope{Data: nil, Error: msg})
}

func BadRequest(c *fiber.Ctx, msg string) error  { return Err(c, fiber.StatusBadRequest, msg) }
func Unauthorized(c *fiber.Ctx) error             { return Err(c, fiber.StatusUnauthorized, "unauthorized") }
func Forbidden(c *fiber.Ctx) error                { return Err(c, fiber.StatusForbidden, "forbidden") }
func NotFound(c *fiber.Ctx) error                 { return Err(c, fiber.StatusNotFound, "not found") }
func Conflict(c *fiber.Ctx, msg string) error     { return Err(c, fiber.StatusConflict, msg) }
func Internal(c *fiber.Ctx) error                 { return Err(c, fiber.StatusInternalServerError, "internal server error") }
