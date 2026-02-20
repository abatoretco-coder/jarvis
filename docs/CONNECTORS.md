# VM400 connectors (execution layer)

Jarvis (VM300) is the “brain”: it converts text into **codified actions**.
VM400 is the “execution layer”: it aggregates inputs (voice/phone/UI) and executes actions.

Jarvis returns actions in `actions[]`.

## Why connectors live on VM400

- Keeps credentials/tokens out of Jarvis
- Lets you swap providers without redeploying Jarvis
- Lets you respect platform rules/ToS (no scraping in Jarvis)

## Action: connector.request

Jarvis can emit a generic action:

```json
{
  "type": "connector.request",
  "connector": "email|whatsapp|messenger|sms",
  "operation": "read_latest|summarize|search",
  "params": { "limit": 5 }
}
```

VM400 handles it and can then:

- execute provider API calls
- produce a user-friendly summary (TTS)
- optionally call Jarvis again with text like: “Summarize these messages: ...”

## Platform reality check (important)

Some platforms don’t provide a clean API for _personal_ accounts:

- WhatsApp: official options are **WhatsApp Business Platform** (Cloud API) or providers (Twilio). Personal account access is not supported.
- Messenger: Graph API is mainly for **Pages** and specific app permissions, not personal inbox.
- SMS: easiest is via phone automation (Home Assistant Companion + notifications / Tasker) or an SMS gateway.
- Email: best options are Microsoft Graph (Outlook/Exchange), Gmail API, or IMAP (self-hosted).

Recommendation: start with **Email + HA notifications**, then add WhatsApp/Messenger only via official/business integrations.

## Your setup: Gmail + Android

Recommended path:

1. Use Gmail API (OAuth) on VM400 to read latest emails and summarize.
2. For SMS: push messages from Android → VM400 via HTTP webhook (simple, ToS-friendly), store locally, then Jarvis can request `sms.read_latest`.

This repo includes an optional reference service under `obeissant/`.
