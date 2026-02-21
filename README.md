# Jarvis stack (v0.1)

Repo layout:

- `jarvis/`: VM300 brain (text → codified actions)

VM400 execution/connectors (Obéissant) is in the Home Assistant repo: https://github.com/abatoretco-coder/home-assistant

Home Assistant est dans un dépôt séparé : https://github.com/abatoretco-coder/home-assistant

## Quickstart (local dev via Docker)

1. Create Jarvis env file:

```bash
cp jarvis/.env.example jarvis/.env
```

2. Start:

```bash
docker compose -f docker-compose.dev.yml up --build
```

3. Verify:

```bash
curl -s http://localhost:8080/health | jq
```

VM400 connectors are run from the Home Assistant repo (Obéissant).

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

Plan-only mode (recommended when VM400 orchestrates execution):

```bash
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"ping","options":{"execute":false}}' | jq
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

Time skill:

```bash
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"time"}' | jq
```

Timer skill (stub):

```bash
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"timer 5m"}' | jq
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

## Optional API key

Set `REQUIRE_API_KEY=true` and `API_KEY=...` and send `X-API-Key` on `/v1/*` endpoints.

```bash
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -H 'x-api-key: YOUR_KEY' \
  -d '{"text":"ping"}' | jq
```

## Docs

See [docs/SETUP.md](docs/SETUP.md).

Voice commands: see [docs/VOICE.md](docs/VOICE.md).

Voice satellites (Raspberry Pi / Bluetooth): see [docs/VOICE_SATELLITES.md](docs/VOICE_SATELLITES.md).

Multi-VM (VM300 Jarvis + VM400 Home Assistant): see [docs/MULTI_VM.md](docs/MULTI_VM.md).

VM400 execution/connectors: see https://github.com/abatoretco-coder/home-assistant

French step-by-step: see [docs/INSTRUCTIONS_FR.md](docs/INSTRUCTIONS_FR.md).

Home Assistant controllers (Plex/Hue/Xiaomi/Spotify): see https://github.com/abatoretco-coder/home-assistant

VM400 orchestrator reference service: see `obeissant/` in https://github.com/abatoretco-coder/home-assistant
