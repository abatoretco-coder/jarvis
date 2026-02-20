# Copilot instructions — Jarvis

## Big picture

- This repo contains two services:
  - **VM300 Jarvis (brain)**: Fastify API that converts text commands into **codified actions**.
    - Entry: `jarvis/src/index.ts` → `buildServer` (`jarvis/src/server.ts`)
    - Main endpoint: `POST /v1/command` (`jarvis/src/routes/command.ts`)
  - **VM400 Orchestrator / Obéissant (execution layer, optional reference)**: executes connector actions (e.g. Gmail/SMS) and calls Jarvis in plan mode.
    - Location: `obeissant/`

## Data flow (VM400 → VM300)

- VM400 sends text to Jarvis: `POST /v1/command` with `options.execute=false`.
- Jarvis returns `{ intent, skill, result, actions[] }`.
- VM400 executes actions via connectors (Gmail/Android/HA/etc.) and optionally speaks/notifications.
- Jarvis can also execute **only** `home_assistant.service_call` when `execute=true` (see `jarvis/src/actions/execute.ts`).

## Action system (core convention)

- Skills **must return actions** (do not embed credentials in Jarvis).
- Action types live in `jarvis/src/actions/types.ts` (`JarvisAction` union).
- Execution support lives in `jarvis/src/actions/execute.ts` and currently only runs `home_assistant.service_call`.
- If you add a new executable action type, update both `jarvis/src/actions/types.ts` and `jarvis/src/actions/execute.ts`.

## Skills system

- Skill interface: `jarvis/src/skills/types.ts` (`match()` returns score; router picks best).
- Router: `jarvis/src/skills/router.ts`.
- Register skills in `jarvis/src/index.ts`.
- Prefer “plan” semantics: skills should emit actions like:
  - `todo.add_task` (VM400 executes via Microsoft/Graph later)
  - `connector.request` for inbox reads (email/sms/whatsapp/messenger)
  - `home_assistant.service_call` for HA operations

## Configuration & secrets

- Env validation is strict and fails fast: `jarvis/src/config/env.ts` (Zod).
- Important flags:
  - `EXECUTE_ACTIONS=false` by default (brain/planner mode)
  - `REQUIRE_API_KEY=true` + `API_KEY=...` protects `/v1/*` (see `jarvis/src/server.ts`)
  - `HA_ENTITY_ALIASES_JSON` maps natural aliases → `entity_id` (used in `/v1/command` ctx)
- Never log tokens/keys; logging is Pino with redaction in `jarvis/src/lib/logger.ts`.

## Developer workflows

- Local dev (hot reload): `cd jarvis && npm run dev`
- Build: `cd jarvis && npm run build` (tsc)
- Lint/format: `cd jarvis && npm run lint`, `cd jarvis && npm run format:write`
- Tests: `cd jarvis && npm test` (Vitest; uses `app.inject()` in `jarvis/src/server.test.ts`)

## Docker/deploy

- Dev compose: `docker compose -f docker-compose.dev.yml up --build`
- Prod compose pulls published image: `docker-compose.prod.yml`
- Jarvis image: `jarvis/Dockerfile` (runtime installs `--omit=dev`)
- Multi-VM guidance:
  - `docs/MULTI_VM.md` (VM300 Jarvis + VM400 Home Assistant)
  - `docs/CONNECTORS.md` (VM400 connectors; Gmail+Android reference)

## GitHub Actions

- GHCR publish workflow: `.github/workflows/ghcr-publish.yml`

## When changing behavior

- Keep `/health` unauthenticated; `/v1/*` may be API-key protected.
- Maintain backwards-compatible response shape for `POST /v1/command`.
- Update docs in `docs/` if you add/rename env vars or action types.
