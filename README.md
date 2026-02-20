# Jarvis (v0.1)

Minimal command router service with a small skills system and Home Assistant integration.

## Quickstart (local dev via Docker)

1. Create `.env`:

```bash
cp .env.example .env
```

2. Start:

```bash
docker compose -f docker-compose.dev.yml up --build
```

3. Verify:

```bash
curl -s http://localhost:8080/health | jq
```

## API

### GET /health

```bash
curl -s http://localhost:8080/health | jq
```

### POST /v1/command

```bash
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"ping"}' | jq
```

Home Assistant skill (explicit command format):

```bash
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"ha: light.turn_on entity_id=light.kitchen"}' | jq
```

Music skill (stub):

```bash
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"play music lo-fi"}' | jq
```

### POST /v1/ha/service

```bash
curl -s http://localhost:8080/v1/ha/service \
  -H 'content-type: application/json' \
  -d '{
    "domain":"light",
    "service":"turn_on",
    "target": {"entity_id":"light.kitchen"},
    "serviceData": {"brightness_pct": 40}
  }' | jq
```

## Docs

See [docs/SETUP.md](docs/SETUP.md).
