IMAGE ?= ghcr.io/abatoretco-coder/jarvis
TAG ?= dev

.PHONY: dev build test lint format docker-build docker-push

dev:
	npm run dev

build:
	npm run build

test:
	npm test

lint:
	npm run lint

format:
	npm run format:write

docker-build:
	docker build --build-arg BUILD_SHA=$$(git rev-parse --short HEAD 2>NUL || echo unknown) --build-arg BUILD_TIME=$$(date -u +%Y-%m-%dT%H:%M:%SZ 2>NUL || echo unknown) -t $(IMAGE):$(TAG) .

docker-push:
	docker push $(IMAGE):$(TAG)
