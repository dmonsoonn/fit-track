package middleware

import (
	"strings"

	"github.com/fittrack/backend/internal/config"
	"github.com/fittrack/backend/internal/response"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gofiber/fiber/v2"
)

type Claims struct {
	UserID int64  `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func Auth(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return response.Unauthorized(c)
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			return response.Unauthorized(c)
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.NewError(fiber.StatusUnauthorized, "unexpected signing method")
			}
			return []byte(cfg.JWTSecret), nil
		})
		if err != nil || !token.Valid {
			return response.Unauthorized(c)
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("role", claims.Role)
		return c.Next()
	}
}

// LocalUserID returns the authenticated user_id from context locals.
func LocalUserID(c *fiber.Ctx) int64 {
	id, _ := c.Locals("user_id").(int64)
	return id
}

// LocalRole returns the authenticated role from context locals.
func LocalRole(c *fiber.Ctx) string {
	r, _ := c.Locals("role").(string)
	return r
}
