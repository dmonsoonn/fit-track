package middleware

import (
	"github.com/fittrack/backend/internal/response"
	"github.com/gofiber/fiber/v2"
)

// RequireRoles returns a middleware that allows only the given roles.
func RequireRoles(roles ...string) fiber.Handler {
	set := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		set[r] = struct{}{}
	}
	return func(c *fiber.Ctx) error {
		role, ok := c.Locals("role").(string)
		if !ok || role == "" {
			return response.Unauthorized(c)
		}
		if _, allowed := set[role]; !allowed {
			return response.Forbidden(c)
		}
		return c.Next()
	}
}
