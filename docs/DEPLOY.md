---
type: Runbook
title: Deploy on the lab VM
description: Deploy the lab monitoring stack and configure first-run access,
  monitors, alerts and backups.
status: stable
tags:
  - deployment
  - monitoring
  - operations
sources:
  - id: compose
    resource: https://github.com/masterevan27/lab-status/blob/2ac1179c0547b8934fc97fb2765cffafac5d18ce/compose.yaml
    title: Uptime Kuma, Homepage and socket proxy services
  - id: env-example
    resource: https://github.com/masterevan27/lab-status/blob/2ac1179c0547b8934fc97fb2765cffafac5d18ce/.env.example
    title: Deployment environment variables
  - id: services
    resource: https://github.com/masterevan27/lab-status/blob/2ac1179c0547b8934fc97fb2765cffafac5d18ce/config/services.yaml
    title: Homepage tiles and container names
  - id: settings
    resource: https://github.com/masterevan27/lab-status/blob/2ac1179c0547b8934fc97fb2765cffafac5d18ce/config/settings.yaml
    title: Homepage settings
  - id: kuma-dockerfile
    resource: https://github.com/masterevan27/lab-status/blob/2ac1179c0547b8934fc97fb2765cffafac5d18ce/kuma/Dockerfile
    title: Uptime Kuma fork image build
  - id: static-test
    resource: https://github.com/masterevan27/lab-status/blob/2ac1179c0547b8934fc97fb2765cffafac5d18ce/test/static.test.js
    title: Configuration consistency tests
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-21T03:05:00Z
stale_after: 2027-01-09T00:00:00Z
---
# Deploy on the lab VM

Run these on the VM that hosts homelab-proxy (Docker Engine, Compose 2.24.4 or
later), in this repository's checkout.

## 1. Prerequisites

- homelab-proxy 0.3.0 or later is running. It creates the `homelab-proxy`
  network and serves the `status` and `home` sites.
- homelab-proxy's `LAB_ALLOWED_CIDRS` includes its `PROXY_SUBNET`. The shipped
  default `172.16.0.0/12` covers `172.31.250.0/24`. If you narrow the list, add
  the proxy subnet back, or Caddy refuses every Uptime Kuma check and all sites
  show down.
- homelab-proxy's root certificate is on the VM. Its `docs/TRUST.md` Linux step
  installs it at `/usr/local/share/ca-certificates/homelab-proxy-root.crt`,
  which is the default `HOMELAB_CA_ROOT`. Check it is a file:

  ```sh
  test -f /usr/local/share/ca-certificates/homelab-proxy-root.crt && echo ok
  ```

  Compose refuses to start Uptime Kuma if the file is missing.
- A checkout of the Uptime Kuma fork, branch `feat/status-page-time-range`,
  next to this repository as `../uptime-kuma`, or at the path set in `KUMA_SRC`.
  Compose builds Uptime Kuma from it: see [Uptime Kuma image](#uptime-kuma-image).

## 2. Confirm container names

```sh
docker ps --format '{{.Names}}' | sort
```

Compare the list with `config/services.yaml`:

- Fix any `container:` name that differs.
- Foundry, SillyTavern and NPC import use the names confirmed on sfdockerhost1:
  `foundry-v13`, `sillytavern` and `lancer-import-gui`. Update them if your VM
  uses different names.

Commit those edits so the repository matches the VM.

## 3. Start

```sh
cp .env.example .env          # check LAB_DOMAIN, PROXY_CADDY_IP, HOMELAB_CA_ROOT, KUMA_SRC
docker compose build uptime-kuma   # several minutes: npm install and frontend build
docker compose up -d
docker compose ps             # three services running; uptime-kuma and homepage healthy
docker compose logs homepage | tail -n 20
```

Homepage must not log a read-only or permission error. If it names a file,
create that file empty in `config/` and add it to the test's `HOMEPAGE_FILES`.

## 4. Uptime Kuma first run

Until an admin account exists, Uptime Kuma's setup page is open to every
client in `LAB_ALLOWED_CIDRS`, and whoever reaches it first becomes the admin.
Do step 1 straight away after `docker compose up -d`. If others share your LAN
or tailnet, do it over an SSH tunnel instead: from your PC run
`ssh -L 3001:<uptime-kuma container IP>:3001 <vm>` (IP from
`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' lab-status-uptime-kuma-1`)
and open `http://localhost:3001`.

Open `https://status.<LAB_DOMAIN>`:

1. Choose **SQLite** and create the admin account. Keep the password in your
   password manager. Reload the page: it must now show the login page, not
   the setup page.
2. Leave **Trust Proxy** disabled unless you have reviewed the trusted-proxy
   scope. Monitoring works with it disabled in the current deployment.
3. **Settings → Docker Hosts → Setup Docker Host:** name `lab`, connection type
   **TCP / HTTP**, daemon `tcp://socket-proxy:2375`. Use **Test**.
4. **Settings → Notifications → Setup Notification:** type **Discord**, paste
   the webhook URL (in Discord: Server Settings → Integrations → Webhooks → New
   Webhook → Copy Webhook URL). Tick **Default enabled** and **Apply on all
   existing monitors**, then **Test**.
5. Add the monitors below. HTTP(s) monitors: interval 60 s, accepted status
   codes `200-399`; if a site answers `401` because of its own login, add `401`.
   Never tick "Ignore TLS/SSL errors".

   | Name | Type | Target |
   |---|---|---|
   | nettools | HTTP(s) | `https://nettools.<LAB_DOMAIN>/` |
   | dashboard | HTTP(s) | `https://dashboard.<LAB_DOMAIN>/api/ready` (accepted `200-299` only) |
   | foundry | HTTP(s) | `https://foundry.<LAB_DOMAIN>/` |
   | sillytavern | HTTP(s) | `https://sillytavern.<LAB_DOMAIN>/` |
   | npc-import | HTTP(s) | `https://npc-import.<LAB_DOMAIN>/` |
   | home | HTTP(s) | `https://home.<LAB_DOMAIN>/` |
   | netmap | HTTP(s) | `https://netmap.<LAB_DOMAIN>/` |
   | photoprism | HTTP(s) | `https://photoprism.<LAB_DOMAIN>/api/v1/status` (runs on its own VM, so it has no Docker Container monitor) |
   | each container from step 2 except `lab-status-uptime-kuma-1` | Docker Container | its name, Docker host `lab` |

   The dashboard's page and `/api/version` keep answering 200 even when it
   can't rebuild its project state from its event log. In that state every
   project request fails, so an outage would look up. `/api/ready`
   (ai-agent-dashboard 0.11.1 or later) needs no sign-in and returns 503
   `{"ok":false}` in that case. Keep its accepted codes at `200-299`, not the
   default `200-399` or `401`, and don't add an API token: the URL is public
   by design and reveals only that one flag. On an older dashboard the URL
   returns `401`, so upgrade the dashboard before switching an existing
   monitor (**Edit** the `dashboard` monitor, change the URL and accepted
   codes, **Save**).

   `st-uplink` is a plugin listener without a page of its own; the SillyTavern
   container monitor covers it.
   On sfdockerhost1, SillyTavern's whitelist rejects the checker with `403`.
   Its HTTP keyword monitor accepts only `403` and requires `config.yaml` in
   the expected whitelist-denial page; the Docker monitor checks container
   health. This verifies the access gate, not an authenticated application page.
   Keep TLS verification enabled and preserve the whitelist.
6. **Status Pages → New Status Page:** name `Lab`, slug `lab`. Add the HTTP(s)
   monitors and save. Homepage's Uptime Kuma tile reads this page.
   The **Uptime range** selector above the list sets both the uptime
   percentage and the heartbeat bar: 24 hours when first opened, or 1, 3 or
   5 hours, 7 days, 30 days or 1 year. The bar shows the range as equal
   buckets; a yellow bucket had both up and down checks, and its tooltip
   gives the counts. The browser remembers the choice per page.

## 5. Check

- `https://home.<LAB_DOMAIN>` shows every tile. Container tiles show running
  with CPU and memory, and the Uptime Kuma tile shows up/down counts.
- Theme and color controls are in the Homepage footer and use browser-local
  preferences. Leave `theme` and `color` unset in `config/settings.yaml` to
  keep those controls available, then refresh the page after configuration changes.
- `curl -sS https://dashboard.<LAB_DOMAIN>/api/ready` prints `{"ok":true}`,
  and the `dashboard` monitor is up. Any other answer means the dashboard
  can't rebuild its state, or is older than 0.11.1.
- Alert test: `docker stop nettools-web-1`. Within about two minutes Discord
  shows the monitor down. `docker start nettools-web-1` and Discord shows it up.

## Back up and restore

The `lab-status_kuma_data` volume holds everything Uptime Kuma knows, including
the admin password hash and the Discord webhook URL. Keep backups private.

```sh
docker compose stop uptime-kuma
docker run --rm -v lab-status_kuma_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/kuma-data-$(date +%F).tgz -C /data .
docker compose start uptime-kuma
```

Restore (replace `DATE`):

```sh
docker compose stop uptime-kuma
docker run --rm -v lab-status_kuma_data:/data -v "$PWD":/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/kuma-data-DATE.tgz -C /data'
docker compose start uptime-kuma
```

Homepage has no state: its configuration is this repository.

## Upgrade

Back up `kuma_data`. Uptime Kuma is built from the fork, so rebase its
`feat/status-page-time-range` branch onto the new upstream tag, change the
local tag in `compose.yaml` (`2.5.5-range.2` becomes `<tag>-range.1`), bump
`VERSION` and `CHANGELOG.md`, then:

```sh
docker compose pull --ignore-buildable
docker compose build uptime-kuma
docker compose up -d
```

Once an upstream release includes the selector, set `image:` back to
`louislam/uptime-kuma:<tag>`, drop `build:` and `kuma/Dockerfile`, and remove
`KUMA_SRC`.

## Uptime Kuma image

Upstream Uptime Kuma shows only the 24-hour uptime on a status page and has no
range control ([uptime-kuma#986](https://github.com/louislam/uptime-kuma/issues/986)).
`kuma/Dockerfile` builds the image from a fork checkout instead: the `src`
build context in `compose.yaml`, `KUMA_SRC`, default `../uptime-kuma`. The
fork's `feat/status-page-time-range` branch is upstream 2.5.5 plus the commits
that add the selector and are meant to become an upstream pull request. The
Dockerfile mirrors the release stage of upstream's `docker/dockerfile` and adds
the frontend build that upstream's release pipeline runs beforehand.
