PORT ?= 3000

.PHONY: help local db-up db-down db-reset dev env static restore deploy

help:
	@echo "make local    - run app locally with Docker Postgres, no Vercel (login demo/demo)"
	@echo "make db-up    - start local Postgres + PostgREST"
	@echo "make db-down  - stop them (data kept)"
	@echo "make db-reset - wipe local DB and re-seed"
	@echo "make dev      - vercel dev (needs Vercel CLI + login)"
	@echo "make restore  - restore holdings from CSV backup"

# Local test: no Vercel, local database
local: db-up
	PORT=$(PORT) node dev-server.mjs

db-up:
	docker compose up -d --wait

db-down:
	docker compose down

db-reset:
	docker compose down -v
	$(MAKE) db-up

dev:
	@test -f .env.local || $(MAKE) env
	vercel dev --listen $(PORT)

env:
	vercel env pull .env.local

static:
	python3 -m http.server $(PORT)

restore:
	node restore.mjs

deploy:
	vercel --prod
