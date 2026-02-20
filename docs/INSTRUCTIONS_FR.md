# Instructions (FR) — Projet Jarvis

Ce dépôt contient :

- **Jarvis (VM300)** : le “cerveau” (texte → intentions → actions codifiées)
- **Obéissant / VM400 Orchestrator (VM400)** : la “couche d’exécution” (voix/téléphone → Jarvis → connecteurs Gmail/Android/HA)

## 0) Pré-requis

- Docker + Docker Compose sur les VM (VM300, VM400)
- Accès réseau VM400 → VM300 sur `8080/tcp` (firewall Proxmox) ou via Tailscale

## 1) Concepts clés

### Jarvis = plan d’actions

- Endpoint : `POST /v1/command`
- Jarvis renvoie `actions[]` (ex: `home_assistant.service_call`, `todo.add_task`, `connector.request`)
- Par défaut on recommande le **mode plan** (VM400 exécute) :
  - `EXECUTE_ACTIONS=false`
  - ou par requête : `{"options":{"execute":false}}`

### VM400 = exécution + intégrations

- VM400 reçoit les entrées (Assist/voix, téléphone, UI)
- VM400 appelle Jarvis (plan)
- VM400 exécute selon le type d’action :
  - HA (services)
  - Gmail (lecture emails)
  - Android SMS (webhook)
  - plus tard : Microsoft To Do, musique, robot, etc.

## 2) Lancer Jarvis en local (PC)

```bash
cp jarvis/.env.example jarvis/.env
docker compose -f docker-compose.dev.yml up --build
```

Home Assistant (UI) : `http://localhost:8123`.

Optionnel (démarrer aussi Obéissant / VM400) :

```bash
cp obeissant/.env.example obeissant/.env
docker compose -f docker-compose.dev.yml --profile vm400 up --build
```

Test :

```bash
curl -s http://localhost:8080/health
curl -s http://localhost:8080/v1/command \
  -H 'content-type: application/json' \
  -d '{"text":"ping","options":{"execute":false}}'
```

## 3) Déployer Jarvis sur VM300

Chemins recommandés :

- `/opt/naas/stacks/jarvis`

Étapes (VM300) :

```bash
sudo mkdir -p /opt/naas/stacks/jarvis
git clone https://github.com/<user>/jarvis.git /opt/naas/stacks/jarvis
cd /opt/naas/stacks/jarvis

cp jarvis/.env.example jarvis/.env

docker compose -f docker-compose.prod.yml up -d
```

Dans le `.env` de Jarvis sur VM300 (recommandé) :

```dotenv
REQUIRE_API_KEY=true
API_KEY=change-me-long-random

# VM400 orchestrateur exécute les intégrations
EXECUTE_ACTIONS=false
```

Test depuis VM400 :

```bash
curl -s http://<VM300_IP>:8080/health
curl -s http://<VM300_IP>:8080/v1/command \
  -H 'content-type: application/json' \
  -H 'x-api-key: change-me-long-random' \
  -d '{"text":"read my emails","options":{"execute":false}}'
```

## 4) Déployer VM400 orchestrator (Gmail + Android)

Le dossier est : `obeissant/`.

Sur VM400 :

```bash
sudo mkdir -p /opt/naas/stacks/jarvis-vm400
sudo mkdir -p /opt/naas/appdata/jarvis-vm400
cd /opt/naas/stacks/jarvis-vm400

# Copier le dossier obeissant/ ici
cp obeissant/.env.example obeissant/.env

docker compose -f obeissant/docker-compose.prod.yml up -d --build
```

### 4.1 Config VM400 → Jarvis

Dans `obeissant/.env` :

```dotenv
JARVIS_BASE_URL=http://<VM300_IP>:8080
JARVIS_API_KEY=change-me-long-random
```

Test :

```bash
curl -s http://<VM400_IP>:8090/health
curl -s http://<VM400_IP>:8090/v1/ingest \
  -H 'content-type: application/json' \
  -d '{"text":"read my emails"}'
```

### 4.2 Config Gmail API (Google)

Tu as besoin d’un **refresh token OAuth**.

Résumé des étapes :

1. Google Cloud Console → créer un projet “Jarvis”
2. Activer l’API **Gmail API**
3. Créer des identifiants **OAuth Client ID**
4. Générer un **refresh token** (flux OAuth)
5. Mettre dans `obeissant/.env` :

```dotenv
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_USER_EMAIL=jai@free.fr
```

Note : le fichier `obeissant/src/gmail.ts` lit le contenu en `metadata` (From/Subject + snippet), ce qui suffit pour un résumé.

## 5) Android → SMS (webhook)

Le service VM400 expose :

- `POST http://<VM400_IP>:8090/v1/inbox/incoming`

Payload :

```json
{ "source": "sms", "from": "+33...", "text": "...", "timestamp": "2026-02-20T12:34:56Z" }
```

Tu peux envoyer ça depuis Android via :

- Tasker
- MacroDroid
- Home Assistant Companion + automatisation (selon ton flow)

Ensuite, Jarvis peut planifier `sms.read_latest` via la skill `inbox`.

## 6) Home Assistant (voix) → VM400 → Jarvis

Recommandation :

- Assist/voix dans Home Assistant
- HA appelle VM400 `/v1/ingest` (pas Jarvis directement)

Comme ça VM400 orchestre TOUT (connecteurs, exécution, TTS).

## 7) Dépannage rapide

- `401 unauthorized` sur Jarvis : vérifier `REQUIRE_API_KEY` + header `x-api-key`
- `Gmail connector not configured` : variables Gmail manquantes
- Réseau : VM400 doit atteindre VM300:8080 (firewall/ACL)

## 8) Limits / conformité

- WhatsApp/Messenger personnels : pas d’API propre officielle → privilégie Business API ou notifications HA.
