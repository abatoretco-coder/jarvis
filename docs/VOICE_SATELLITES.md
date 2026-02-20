# Voice satellites (Raspberry Pi / Bluetooth) — configuration flexible

Jarvis v0.1 traite du texte (`POST /v1/command`).
Pour des commandes vocales “réelles” (micro + wake word + STT + TTS), le setup le plus flexible est :

- Les périphériques externes (Raspberry Pi, tablette, etc.) servent de **satellites audio**
- **Home Assistant** est le **hub** (wake word/STT/TTS selon ton choix)
- Home Assistant envoie le **texte reconnu** à Jarvis

Ça te permet de changer de matériel (Raspberry Pi, enceintes BT, etc.) sans toucher Jarvis.

## Topologies recommandées

### Option A (recommandée) — Home Assistant gère la voix

1. Satellite (RPi/phone) → micro
2. Home Assistant (Assist) → STT (cloud ou local)
3. Home Assistant → appelle Jarvis (`rest_command` / script)
4. Home Assistant → TTS vers un lecteur (enceinte BT, Media Player, etc.)

Avantages : le plus simple à maintenir, 1 seule “source de vérité”, UI HA.

### Option B — Satellite autonome (STT/TTS sur RPi)

Le RPi convertit voix→texte (STT) et texte→voix (TTS), et appelle Jarvis directement.

Avantages : HA optionnel. Inconvénients : plus complexe (tu maintiens STT/TTS sur chaque RPi).

## Variables “flexibles” à standardiser

Même si tu changes d’approche, standardise ces paramètres :

- `JARVIS_URL` ex: `http://jarvis:8080`
- `JARVIS_API_KEY` (si activée)
- `HA_URL` ex: `http://home-assistant:8123`
- `HA_TOKEN` (si un satellite doit parler à HA)

## Raspberry Pi + enceinte Bluetooth (audio output)

But : HA parle sur une enceinte BT à proximité.

1. Sur le RPi, pair l’enceinte BT (exemple, la commande exacte dépend de l’OS) :

```bash
bluetoothctl
# scan on
# pair XX:XX:XX:XX:XX:XX
# trust XX:XX:XX:XX:XX:XX
# connect XX:XX:XX:XX:XX:XX
```

2. Vérifie qu’un “sink” audio est dispo (PipeWire/PulseAudio selon distro).

3. Dans Home Assistant, expose le lecteur (selon ta stack : Bluetooth sur le RPi + intégration audio / ou lecteur réseau).

Ensuite la réponse (TTS) de HA peut être envoyée vers ce lecteur.

## Raspberry Pi “satellite micro + speaker”

Deux approches pratiques :

### A) Utiliser les satellites Assist/Home Assistant (recommandé)

Home Assistant a des solutions “satellite” (selon ta version/installation HA). L’idée reste la même :

- le satellite capture le micro
- HA exécute Assist (wake word/STT)
- HA déclenche `script.jarvis_voice_command` (voir ci-dessous)

### B) Utiliser une app (ultra simple)

Le moyen le plus rapide : l’app Home Assistant sur un vieux téléphone/tablette.
Tu poses l’app près de l’enceinte, et tu utilises Assist, puis HA appelle Jarvis.

## Côté Home Assistant : 1 script standard

Quel que soit le matériel, garde un point d’entrée unique :

```yaml
script:
  jarvis_voice_command:
    alias: Jarvis voice command
    fields:
      text:
        description: The recognized speech text
        example: 'turn on kitchen light'
    sequence:
      - service: rest_command.jarvis_command
        data:
          text: '{{ text }}'
```

Et le `rest_command` (dans VOICE.md) envoie vers Jarvis.

## Sécurité

- Active `REQUIRE_API_KEY=true` + `API_KEY=...` dans Jarvis.
- Dans Home Assistant, mets la clé dans `secrets.yaml` et envoie `x-api-key` dans `rest_command`.

## Besoin d’un plan exact “chez toi”

Dis-moi juste :

1. Home Assistant tourne où ? (HA OS / Docker / VM)
2. Combien de satellites ? (1, 2, …)
3. Tu veux wake word local (“Jarvis”) ou bouton/app OK ?
4. STT/TTS local (Whisper/Piper) ou cloud ?

Et je te donne une procédure d’installation précise + un schéma réseau + fichiers de config adaptés.
