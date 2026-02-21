# Jarvis (VM300)

Ce dossier contient le service Jarvis (Fastify) qui reçoit du texte et renvoie :
- soit une réponse conversationnelle,
- soit un plan d’actions codifiées.

## Règle de sécurité (secrets)

Ne mets pas de secrets dans git.
- `.env` reste **ignoré** (`.gitignore`) et doit être présent **localement** uniquement.
- Le repo fournit `.env.example` comme template.

## Télécommande VM300 (depuis ton PC)

Le script PowerShell [scripts/vm300.ps1](scripts/vm300.ps1) permet de gérer VM300 sans recopier les commandes à la main.

Depuis ce dossier :

```powershell
./scripts/vm300.ps1 init-ssh

# 1) crée .env localement (copie .env.example -> .env puis remplis tes secrets)
# 2) push le .env sur VM300
./scripts/vm300.ps1 push-env

# déploie / rebuild / health check
./scripts/vm300.ps1 oneshot
```

## Docker

- Dev: `docker-compose.dev.yml`
- Prod: `docker-compose.prod.yml`

En prod, `/opt/naas/appdata/jarvis-vm300` est monté sur `/app/data` pour persister la mémoire (si activée).

## OpenAI fallback (optionnel)

Si `OPENAI_API_KEY` est renseigné dans `.env`, Jarvis peut gérer les messages non reconnus :
- soit en mode chat,
- soit en réécriture vers une commande Jarvis supportée.

Jarvis n’a pas besoin d’être exposé sur Internet : il doit juste pouvoir sortir en HTTPS (443) vers OpenAI.
