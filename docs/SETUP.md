# Jarvis setup & deployment

## Local development

### Option A: Docker compose (recommended)

```bash
cp jarvis/.env.example jarvis/.env
docker compose -f docker-compose.dev.yml up --build
```

Home Assistant will be available at `http://localhost:8123`.

Optional (also run VM400 connectors):

```bash
cp obeissant/.env.example obeissant/.env
docker compose -f docker-compose.dev.yml --profile vm400 up --build
```

The service listens on `http://localhost:8080` by default.

### Option B: Node directly (Jarvis only)

```bash
cd jarvis
npm install
cp .env.example .env
npm run dev
```

## Environment variables

Jarvis is configured entirely through environment variables (no secrets in git).

Required:

- `PORT` (default `8080`)
- `LOG_LEVEL` (default `info`)
- `BODY_LIMIT_BYTES` (default `1048576`)
- `HA_BASE_URL` (example: `http://home-assistant:8123`)
- `HA_TOKEN` (Home Assistant long-lived access token)
- `HA_TIMEOUT_MS` (default `10000`)

Optional:

- `ALLOW_CORS` (`true`/`false`, default `false`)
- `CORS_ORIGIN` (if CORS enabled; default `*`)
- `REQUIRE_API_KEY` (`true`/`false`, default `false`)
- `API_KEY` (required if `REQUIRE_API_KEY=true`)
- `BUILD_SHA`, `BUILD_TIME` (set by Docker build)

## Build and push to GHCR

If you use GitHub Actions, this repo includes a workflow that publishes to GHCR:

- On push to `main`: publishes `:main` and `:sha-<short>`
- On tag `vX.Y.Z`: publishes `:X.Y.Z` and `:latest`

1. Authenticate Docker to GHCR:

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u <user> --password-stdin
```

2. Build (with metadata):

```bash
docker build \
  --build-arg BUILD_SHA=$(git rev-parse --short HEAD) \
  --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  -t ghcr.io/<user>/jarvis:0.1.0 \
  -t ghcr.io/<user>/jarvis:latest \
  ./jarvis
```

3. Push:

```bash
docker push ghcr.io/<user>/jarvis:0.1.0
docker push ghcr.io/<user>/jarvis:latest
```

## Deploy on VM300 (Proxmox) under /opt/naas/stacks/jarvis

Recommended directory layout:

- `/opt/naas/stacks/jarvis` (compose + env)
- `/opt/naas/appdata/jarvis` (optional, reserved)
- `/opt/naas/logs/jarvis` (optional)

On VM300:

```bash
sudo mkdir -p /opt/naas/stacks/jarvis
sudo mkdir -p /opt/naas/appdata/jarvis
sudo mkdir -p /opt/naas/logs/jarvis
cd /opt/naas/stacks/jarvis
```

Deploy by cloning (recommended):

```bash
git clone https://github.com/<user>/jarvis.git /opt/naas/stacks/jarvis
cd /opt/naas/stacks/jarvis
cp jarvis/.env.example jarvis/.env
```

Optional (only if you want to run VM400 connectors from the same stack folder):

```bash
cp obeissant/.env.example obeissant/.env
```

Edit `docker-compose.prod.yml` and set the image to your published tag:

```yaml
image: ghcr.io/<user>/jarvis:0.1.0
```

Start:

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Health check:

```bash
curl -s http://127.0.0.1:8080/health
```

## Home Assistant usage examples

### Direct service call

```bash
curl -s http://<jarvis-host>:8080/v1/ha/service \
  -H 'content-type: application/json' \
  -d '{"domain":"light","service":"turn_off","target":{"entity_id":"light.kitchen"}}'
```

### Command-based (skill router)

Jarvis supports a very basic explicit format:

- `ha: <domain>.<service> entity_id=<entity_id> key=value ...`

Example:

```bash
curl -s http://<jarvis-host>:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"ha: light.turn_on entity_id=light.kitchen brightness_pct=40"}'
```

## Security TODO

Jarvis supports optional API-key auth for `/v1/*` endpoints:

- Set `REQUIRE_API_KEY=true`
- Set `API_KEY=<your secret>`
- Send `X-API-Key: <your secret>`

Health endpoints remain unauthenticated for monitoring.

## Voice commands

See [docs/VOICE.md](VOICE.md) for wiring Home Assistant Assist voice → Jarvis text commands.

## Multi-VM (VM300 + VM400)

If you plan to run Home Assistant on a separate VM (e.g. VM400) and Jarvis on VM300, see [docs/MULTI_VM.md](MULTI_VM.md).
