# ─────────────────────────────────────────────────────────────────────────────
#  FitTrack — Makefile
#  Run `make help` to see all available targets.
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: dev infra up down build run seed tidy help

BACKEND_DIR := ./backend
BINARY      := $(BACKEND_DIR)/bin/server

# ── PRIMARY TARGET ────────────────────────────────────────────────────────────
# Start postgres + minio, then run the Go server locally (no Docker for backend)
dev: infra
	@echo ">>> Starting backend (go run)..."
	cd $(BACKEND_DIR) && go run ./cmd/server

# ── INFRASTRUCTURE ────────────────────────────────────────────────────────────
# Start only postgres and minio as Docker containers
infra:
	@echo ">>> Starting postgres and minio..."
	docker compose up -d postgres minio
	@echo ">>> Waiting for postgres to be ready..."
	@docker compose exec postgres sh -c 'until pg_isready -U user -d fittrack; do sleep 1; done'
	@echo ">>> Postgres is ready."

# ── FULL DOCKER STACK ─────────────────────────────────────────────────────────
up:
	docker compose up -d --build

down:
	docker compose down

# ── BUILD & RUN BINARY ────────────────────────────────────────────────────────
build:
	@echo ">>> Building server binary -> $(BINARY)"
	cd $(BACKEND_DIR) && go build -o bin/server ./cmd/server

run: build infra
	@echo ">>> Running compiled binary..."
	cd $(BACKEND_DIR) && ./bin/server

# ── DATABASE ──────────────────────────────────────────────────────────────────
seed:
	@echo ">>> Seeding admin user..."
	cd $(BACKEND_DIR) && go run ./cmd/seed

# ── DEPENDENCIES ─────────────────────────────────────────────────────────────
tidy:
	cd $(BACKEND_DIR) && go mod tidy

# ── HELP ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  make dev    — start infra + run backend locally with go run  (main target)"
	@echo "  make infra  — start postgres + minio containers only"
	@echo "  make up     — build & start the entire stack in Docker"
	@echo "  make down   — stop all Docker services"
	@echo "  make build  — compile backend binary to backend/bin/server"
	@echo "  make run    — build binary + start infra + run binary"
	@echo "  make seed   — seed admin user (requires running infra)"
	@echo "  make tidy   — run go mod tidy in backend/"
	@echo ""
