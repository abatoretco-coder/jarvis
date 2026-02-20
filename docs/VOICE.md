# Voice commands (real speech) for Jarvis

Jarvis v0.1 is a text-command service.

The simplest “real voice command” setup is:

1. Home Assistant does speech-to-text (Assist)
2. Home Assistant sends the recognized text to Jarvis (`POST /v1/command`)

This keeps Jarvis small/secure and lets Home Assistant handle microphones, wake words, and STT.

## 1) Prereqs

- Jarvis reachable from Home Assistant (same Docker network or LAN)
- Optional but recommended: enable Jarvis API key
  - `REQUIRE_API_KEY=true`
  - `API_KEY=<long random secret>`

## 2) Add a Home Assistant `rest_command`

Add this to your Home Assistant configuration (or create via UI equivalents):

```yaml
rest_command:
  jarvis_command:
    url: 'http://jarvis:8080/v1/command'
    method: POST
    headers:
      content-type: application/json
      # If you enabled Jarvis API key:
      # x-api-key: "!secret jarvis_api_key"
    payload: '{"text":"{{ text }}"}'
    timeout: 10
```

If you use `secrets.yaml`:

```yaml
jarvis_api_key: 'YOUR_LONG_RANDOM_SECRET'
```

## 3) Trigger it from Assist

You have two common approaches:

### A) A script you can run from Assist

Create a script that calls the `rest_command`:

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

Then, in the Assist UI, you can run `script.jarvis_voice_command` and pass the recognized text.

### B) Intent/sentence based

If you use custom intents/sentences in Home Assistant, map them to a call to `rest_command.jarvis_command`.
The details vary based on your Assist setup (satellites / sentence triggers / intents).

## 4) Verify

From Home Assistant Developer Tools → Services:

- Service: `rest_command.jarvis_command`
- Data:

```yaml
text: 'ping'
```

Jarvis should respond with the normal command router response.

## Notes

- Jarvis `/health` stays unauthenticated for monitoring.
- If you want Jarvis to do STT itself (audio upload → transcription → route), say so and I’ll add an optional STT sidecar container + endpoint.
