package main

import (
	"context"
	"log"

	"github.com/fittrack/backend/internal/config"
	"github.com/fittrack/backend/internal/db"
	"github.com/fittrack/backend/internal/middleware"
	"github.com/fittrack/backend/internal/modules/auth"
	"github.com/fittrack/backend/internal/modules/clients"
	"github.com/fittrack/backend/internal/modules/exercises"
	"github.com/fittrack/backend/internal/modules/food_log"
	"github.com/fittrack/backend/internal/modules/media"
	"github.com/fittrack/backend/internal/modules/message_templates"
	"github.com/fittrack/backend/internal/modules/notifications"
	"github.com/fittrack/backend/internal/modules/trainers"
	"github.com/fittrack/backend/internal/modules/stats"
	"github.com/fittrack/backend/internal/modules/users"
	"github.com/fittrack/backend/internal/modules/workout_plans"
	"github.com/fittrack/backend/internal/modules/workout_results"
	"github.com/fittrack/backend/internal/modules/workouts"
	"github.com/fittrack/backend/internal/storage"
	fiberlog "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/cors"

	"github.com/gofiber/fiber/v2"
)

func main() {
	cfg := config.Load()
	pool := db.Connect(cfg)
	defer pool.Close()

	db.RunMigrations(context.Background(), pool)

	s3 := storage.NewS3Client(cfg)

	app := fiber.New(fiber.Config{
		BodyLimit: 200 * 1024 * 1024, // 200 MB for video uploads
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"data": nil, "error": err.Error()})
		},
	})

	app.Use(fiberlog.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PATCH, DELETE, OPTIONS",
	}))

	// Public routes (no auth required)
	auth.RegisterRoutes(app, pool, cfg)

	// All routes below require authentication
	authMW    := middleware.Auth(cfg)
	adminMW   := middleware.RequireRoles("admin")
	trainerMW := middleware.RequireRoles("trainer", "admin")
	clientMW  := middleware.RequireRoles("client")

	api := app.Group("/api/v1", authMW)

	users.RegisterRoutes(api, pool, adminMW)
	stats.RegisterRoutes(api, pool, adminMW)
	trainers.RegisterRoutes(api, pool, trainerMW)
	clients.RegisterRoutes(api, pool, trainerMW, clientMW)
	exercises.RegisterRoutes(api, pool, s3, trainerMW)
	workout_plans.RegisterRoutes(api, pool, trainerMW, clientMW)
	workouts.RegisterRoutes(api, pool, trainerMW, clientMW)
	workout_results.RegisterRoutes(api, pool, trainerMW, clientMW)
	notifications.RegisterRoutes(api, pool)
	message_templates.RegisterRoutes(api, pool, trainerMW)
	food_log.RegisterRoutes(api, pool, trainerMW, clientMW)
	media.RegisterRoutes(api, s3)

	log.Printf("server starting on :%s", cfg.Port)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
