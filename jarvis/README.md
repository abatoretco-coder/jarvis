# Jarvis (VM300) — brain/orchestrator

Jarvis est un service **HTTP** (Fastify) qui reçoit du texte et renvoie :
- une **réponse** (chat) ou
- un **plan d’actions codifiées** (ex: appels Home Assistant), et peut éventuellement exécuter ces actions si `EXECUTE_ACTIONS=true`.

Jarvis contient un routeur de "skills" (règles). Si aucune skill ne matche et si `OPENAI_API_KEY` est configuré, Jarvis utilise **OpenAI en fallback** pour :
- répondre en mode conversation (`skill=llm`, `intent=chat`), ou
- réécrire la demande en une commande Jarvis connue, puis rerouter (`intent` préfixé `llm.rewrite.*`).

## Démarrage (dev)

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

Test :

```bash
curl -s http://localhost:8080/health
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"ping"}'
```

## Démarrage (prod)

```bash
cp .env.example .env
docker compose -f docker-compose.prod.yml up -d
```

## Configuration (.env)

Fichier exemple : `.env.example`.

### Variables importantes

- `HA_BASE_URL` / `HA_TOKEN` : nécessaires pour les skills HA (et l’exécution si activée).
- `EXECUTE_ACTIONS` :
  - `false` (recommandé multi-VM) : Jarvis **planifie** seulement.
  - `true` : Jarvis **exécute** les actions supportées (actuellement appels HA).

### OpenAI fallback (optionnel)

- `OPENAI_API_KEY` : active le fallback quand aucune skill ne matche.
- `OPENAI_MODEL` : par défaut `gpt-4o-mini`.
- `OPENAI_TIMEOUT_MS` : timeout réseau.

**Réseau** : Jarvis n’a pas besoin d’être exposé internet. Il a juste besoin de **sortir** en HTTPS vers `api.openai.com` (port 443).

### Mémoire conversationnelle 24h

- `MEMORY_DIR=/app/data/memory`
- `MEMORY_TTL_HOURS=24`
- `MEMORY_MAX_MESSAGES=40`

En prod, `docker-compose.prod.yml` monte `/opt/naas/appdata/jarvis-vm300:/app/data` pour persister la mémoire.

## API

### POST /v1/command

Plan-only :

```bash
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"allume lumière cuisine 40%","options":{"execute":false}}'
```

Exécution :

```bash
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"ha: light.turn_on entity_id=light.kitchen","options":{"execute":true}}'
```

Conversation (fallback OpenAI) :

```bash
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"Explique moi comment fonctionne la domotique ici"}'
```

### Identifiants de conversation (mémoire)

Pour une mémoire stable, envoie un `context` avec un identifiant stable (ex: deviceId, sessionId) :

```bash
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"salut","context":{"deviceId":"android-01"}}'
```

## Tests

```bash
npm test
```

## Dépannage

- Vérifier que Jarvis tourne : `curl -s http://<vm300-ip>:8080/health`
- Vérifier la sortie internet vers OpenAI (depuis VM300) : `wget -qO- https://api.openai.com/v1/models >/dev/null` (attendu: 401 sans clé)
- Logs : `docker compose -f docker-compose.prod.yml logs -f --tail=200`
