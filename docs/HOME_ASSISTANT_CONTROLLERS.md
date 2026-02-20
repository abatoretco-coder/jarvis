# Home Assistant — Controllers (Plex, Hue, Xiaomi X20+, Spotify)

This repo runs Home Assistant as a container service in the root compose stack.
Once Home Assistant is up, controllers are added via **Settings → Devices & services → Add integration**.

These settings are stored in Home Assistant’s `/config` directory (persisted via the mounted volume), so you can change integrations/settings **without rebuilding any Docker image**.

Home Assistant UI:

- Dev: `http://localhost:8123`
- Prod: `http://<host>:8123`

## Important: Docker networking (discovery)

Some integrations rely on multicast discovery (mDNS/SSDP/UPnP). With Docker bridge networking, discovery can be flaky.

- On Linux, the most reliable approach is to run Home Assistant with **host networking**.
- On Docker Desktop (Windows/macOS), host networking is limited; prefer manual configuration and ensure L2 connectivity.

If discovery fails, don’t block on it: add the integration manually when possible.

## Plex

Goal: control Plex entities in HA (media players + sensors).

Prereqs:

- Plex server reachable from Home Assistant over the network (same LAN or routed).
- Know your Plex server address (e.g. `http://NAS_IP:32400`).

Steps:

1. Home Assistant → **Settings → Devices & services → Add integration**.
2. Search **Plex**.
3. Follow the auth flow (it will link your Plex account).

Troubleshooting:

- If HA can’t find your server, make sure the server is reachable from the HA container network.
- If you’re on a different subnet/VLAN, allow TCP `32400` and DNS resolution.

## Philips Hue

Goal: control lights/scenes via the Hue Bridge.

Prereqs:

- Hue Bridge on the same LAN.

Steps:

1. HA → **Add integration** → **Philips Hue**.
2. Select the discovered bridge (or enter its IP if requested).
3. Press the **link button** on the bridge when prompted.

Troubleshooting:

- If discovery doesn’t show the bridge, try adding by IP.
- Ensure multicast isn’t blocked (VLAN rules) if you rely on discovery.

## Xiaomi Robot Vacuum X20+

Goal: start/stop/return-to-dock, cleaning modes, etc.

Reality check: Xiaomi vacuums can be **local-token (miIO)** or **MiOT/cloud-backed** depending on model/region.
So there isn’t one guaranteed “official one-click” path for every device.

Recommended approach:

1. In HA, try the official integration **Xiaomi Miio** first.
2. If it’s not supported / can’t be set up, use a community integration via HACS (common options are “Xiaomi Miot …” variants).

What you typically need:

- Vacuum IP address on your LAN
- Device token (often extracted from the Xiaomi/Mi Home app backups)

Notes:

- If you need maps, you’ll likely add a separate map extractor integration (varies by model).

## Spotify

Goal: control Spotify playback (and expose entities in HA).

Prereqs:

- A Spotify account
- Create a Spotify Developer app to get `Client ID` + `Client Secret`

Steps:

1. Go to `https://developer.spotify.com/dashboard` and create an app.
2. In the app settings, add a **Redirect URI**:
   - `http://<your-home-assistant-host>:8123/auth/external/callback`
3. In Home Assistant: **Add integration → Spotify**.
4. Enter `Client ID` and `Client Secret`, then complete OAuth login.

Troubleshooting:

- If callback fails, ensure Home Assistant is reachable at the exact hostname used in the redirect URI.
