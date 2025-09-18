# Makefile for Downlodr Docker operations (React + Electron App)

# Variables
DOCKER_IMAGE = downlodr
DOCKER_TAG = latest
CONTAINER_NAME = downlodr-app
DEV_CONTAINER_NAME = downlodr-dev

# Default target
.DEFAULT_GOAL := help

# Help command
help: ## Show this help message
	@echo "Available commands for Downlodr (React + Electron App):"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Production commands
build: ## Build production Docker image for Electron app
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .

run: ## Run production container with Electron GUI via VNC
	docker run -d \
		--name $(CONTAINER_NAME) \
		-p 5900:5900 \
		-v $$(pwd)/downloads:/app/downloads \
		-v $$(pwd)/data:/app/data \
		$(DOCKER_IMAGE):$(DOCKER_TAG)

start: ## Start production services (Electron app + VNC access)
	docker-compose up -d

stop: ## Stop production services
	docker-compose down

restart: ## Restart production services
	docker-compose restart

logs: ## View production container logs (Electron + React)
	docker-compose logs -f

# Development commands
build-dev: ## Build development Docker image for hot-reload development
	docker build -f Dockerfile.dev -t $(DOCKER_IMAGE):dev .

run-dev: ## Run development container with source mounting
	docker run -d \
		--name $(DEV_CONTAINER_NAME) \
		-p 5900:5900 \
		-v $$(pwd):/app \
		-v $$(pwd)/downloads:/app/downloads \
		-v $$(pwd)/data:/app/data \
		$(DOCKER_IMAGE):dev

start-dev: ## Start development services (with React hot-reload)
	docker-compose -f docker-compose.dev.yml up -d

stop-dev: ## Stop development services
	docker-compose -f docker-compose.dev.yml down

logs-dev: ## View development container logs
	docker-compose -f docker-compose.dev.yml logs -f

# Electron-specific commands
electron-start: ## Start Electron app directly in container
	docker exec -it $(CONTAINER_NAME) yarn start

electron-package: ## Package Electron app in container
	docker exec -it $(CONTAINER_NAME) yarn package

electron-make: ## Make Electron distributables in container
	docker exec -it $(CONTAINER_NAME) yarn make

# React development commands
react-build: ## Build React components in container
	docker exec -it $(CONTAINER_NAME) yarn build || echo "No separate React build script found"

# Utility commands
shell: ## Open shell in production container
	docker exec -it $(CONTAINER_NAME) sh

shell-dev: ## Open shell in development container
	docker exec -it $(DEV_CONTAINER_NAME) sh

clean: ## Remove containers and images
	docker-compose down -v
	docker-compose -f docker-compose.dev.yml down -v
	docker rmi $(DOCKER_IMAGE):$(DOCKER_TAG) $(DOCKER_IMAGE):dev 2>/dev/null || true

clean-all: ## Clean all Docker resources
	docker-compose down -v
	docker-compose -f docker-compose.dev.yml down -v
	docker system prune -af
	docker volume prune -f

status: ## Show container status
	@echo "=== Production Containers ==="
	@docker-compose ps
	@echo ""
	@echo "=== Development Containers ==="
	@docker-compose -f docker-compose.dev.yml ps

health: ## Check container health
	@echo "=== Container Health Status ==="
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Quick setup commands
setup: build start ## Build and start production environment

setup-dev: build-dev start-dev ## Build and start development environment

# VNC access helpers
vnc-info: ## Show VNC connection information
	@echo "=== VNC Connection Information ==="
	@echo "VNC Server: localhost:5900"
	@echo "Web VNC: http://localhost:8000"
	@echo ""
	@echo "macOS: vnc://localhost:5900"
	@echo "Windows/Linux: Use VNC viewer with localhost:5900"

# Maintenance commands
update: ## Update and rebuild containers
	git pull
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d

backup-data: ## Backup application data
	tar -czf downlodr-backup-$$(date +%Y%m%d_%H%M%S).tar.gz downloads/ data/

restore-permissions: ## Fix permissions for mounted volumes
	sudo chown -R $$(id -u):$$(id -g) downloads/ data/

.PHONY: help build run start stop restart logs build-dev run-dev start-dev stop-dev logs-dev shell shell-dev clean clean-all status health setup setup-dev vnc-info update backup-data restore-permissions
