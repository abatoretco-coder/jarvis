# Multi-VM setup (VM300 Jarvis + VM400 Home Assistant)

Objectif :

- VM300 (app-host) exécute Jarvis (Docker)
- VM400 exécute Home Assistant / Assist (voix)
- VM400 envoie les commandes (texte reconnu) à Jarvis

Jarvis n’a pas besoin d’accéder à VM400 : c’est **VM400 → VM300**.

## 1) Réseau (recommandé)

Tu as 2 options propres :

### Option A — LAN + firewall Proxmox

- Donne une IP fixe à VM300 et VM400 (DHCP reservation ou statique)
- Autorise uniquement VM400 → VM300 sur le port Jarvis

Ports typiques :

- VM300: `8080/tcp` (Jarvis)

Règle firewall :

- Allow: VM400 → VM300:8080
- Deny: autres sources → VM300:8080

### Option B — Tailscale (souvent le plus simple)

- Installe Tailscale sur VM300 et VM400
- Utilise MagicDNS (ex: `jarvis-vm300.tailnet-xxxx.ts.net`)
- Restreins l’accès via ACL Tailscale

Avantage : pas de routage/port ouvert sur le LAN, contrôle fin par ACL.

## 2) Jarvis (VM300)

Déploiement standard dans `/opt/naas/stacks/jarvis` (voir SETUP).

Je recommande d’activer la clé API puisque VM400 est une machine séparée :

Dans `.env` de Jarvis (VM300) :

```dotenv
REQUIRE_API_KEY=true
API_KEY=change-me-to-a-long-random-secret
```

Redémarre Jarvis :

```bash
cd /opt/naas/stacks/jarvis
docker compose -f docker-compose.prod.yml up -d
```

Test depuis VM400 :

```bash
curl -s http://<VM300_IP>:8080/health
curl -s http://<VM300_IP>:8080/v1/command \
  -H 'content-type: application/json' \
  -H 'x-api-key: change-me-to-a-long-random-secret' \
  -d '{"text":"ping"}'
```

## 3) Home Assistant (VM400) → Jarvis

Dans Home Assistant, configure un `rest_command` qui pointe vers Jarvis sur VM300.

Si HA est en YAML :

```yaml
rest_command:
  jarvis_command:
    url: 'http://<VM300_IP>:8080/v1/command'
    method: POST
    headers:
      content-type: application/json
      x-api-key: '!secret jarvis_api_key'
    payload: '{"text":"{{ text }}"}'
    timeout: 10
```

Et dans `secrets.yaml` (VM400) :

```yaml
jarvis_api_key: 'change-me-to-a-long-random-secret'
```

Ensuite, tout ce que fait Assist (voix → texte) doit appeler ce `rest_command`.

## 4) “Recevoir des infos de VM400”

Concrètement :

- VM400 “push” des infos à Jarvis via `POST /v1/command` (ou un endpoint dédié dans une v0.2)
- Jarvis renvoie la réponse (intent/skill/result/actions)
- Home Assistant peut ensuite :
  - parler la réponse (TTS)
  - déclencher des services HA
  - logguer / notifier

Si tu veux que VM400 envoie des événements structurés (pas du texte), dis-moi et j’ajoute un endpoint `POST /v1/event` (avec schéma Zod) + une skill “events”.

## 5) Checklist rapide

- [ ] VM300 et VM400 se ping (ou via Tailscale)
- [ ] VM400 peut `curl http://VM300:8080/health`
- [ ] API key activée et stockée dans `secrets.yaml`
- [ ] Assist déclenche un script/service qui appelle `rest_command.jarvis_command`
