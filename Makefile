# ─────────────────────────────────────────────────────────────────────────────
#  FitTrack — Makefile
#  Run `make help` to see all available targets.
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: dev dev-backend infra up down build run seed tidy web web-install web-build help

BACKEND_DIR  := ./backend
FRONTEND_DIR := ./frontend
BINARY       := $(BACKEND_DIR)/bin/server

# ── PRIMARY TARGET ────────────────────────────────────────────────────────────
# Start postgres + minio, then run the Go backend and the Vite frontend together.
# Both run concurrently; press Ctrl-C once to stop both (trap kills the whole group).
dev: infra web-install
	@echo ">>> Starting backend (:8080) + frontend (:5173). Press Ctrl-C to stop both."
	@trap 'kill 0' INT TERM; \
		( cd $(BACKEND_DIR) && go run ./cmd/server ) & \
		( cd $(FRONTEND_DIR) && npm run dev ) & \
		wait

# Backend only (no frontend), running locally with go run.
dev-backend: infra
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

# ── FRONTEND ──────────────────────────────────────────────────────────────────
# Install frontend dependencies (run once, or after package.json changes)
web-install:
	@echo ">>> Installing frontend dependencies..."
	cd $(FRONTEND_DIR) && npm install

# Start the Vite dev server (http://localhost:5173). Needs the backend running (make dev).
web: web-install
	@echo ">>> Starting frontend dev server on http://localhost:5173 ..."
	cd $(FRONTEND_DIR) && npm run dev

# Type-check and build the production frontend bundle into frontend/dist
web-build: web-install
	@echo ">>> Building frontend production bundle..."
	cd $(FRONTEND_DIR) && npm run build

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
	@echo "  make dev          — start infra + run backend AND frontend together  (main target)"
	@echo "  make dev-backend  — start infra + run backend only (go run)"
	@echo "  make infra        — start postgres + minio containers only"
	@echo "  make up           — build & start the entire stack in Docker"
	@echo "  make down         — stop all Docker services"
	@echo "  make build        — compile backend binary to backend/bin/server"
	@echo "  make run          — build binary + start infra + run binary"
	@echo "  make seed         — seed admin user (requires running infra)"
	@echo "  make tidy         — run go mod tidy in backend/"
	@echo "  make web          — install deps + run the Vite frontend dev server (:5173)"
	@echo "  make web-install  — install frontend dependencies"
	@echo "  make web-build    — type-check & build the production frontend bundle"
	@echo ""
