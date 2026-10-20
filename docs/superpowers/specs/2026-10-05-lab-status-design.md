---
type: Design
title: lab-status design
description: Design goals, architecture and constraints for the private lab
  monitoring and service landing stack.
status: stable
tags:
  - monitoring
  - architecture
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-05T01:13:04-04:00
---
# lab-status design

Date: 2026-10-05. Status: implemented in lab-status 0.1.0 and homelab-proxy 0.3.0; deployment on the VM pending (docs/DEPLOY.md).

## Goal

A private ops view of the lab Docker VM (`sfdockerhost1`, the VM that runs
`homelab-proxy`) for the owner only. Three things:

1. Up/down state and uptime history of every lab app and container, with
   Discord alerts on change.
2. Live CPU and memory per container, plus VM-wide CPU, memory and disk.
3. One landing page linking every lab app and showing its status.

Not a public status page: nobody else reads it, so incidents, maintenance
notices and subscriber email are out of scope.

## Decisions

- **Cachet is not used.** It only displays statuses pushed to its API, its last
  stable release is v2.4.1 (years old), v3 is unreleased, and its Docker image
  is stale. The goal is monitoring, which Cachet does not do.
- **Uptime Kuma** does the checking, alerting and uptime history.
- **Homepage** is the links hub and shows per-container status and resources.
- **Beszel/cAdvisor are deferred.** Homepage's live figures are enough; add a
  history tool only if resource trends are wanted later.
- **A separate repository** (`lab-status`), like every other proxied app,
  rather than containers inside `homelab-proxy`.

## Architecture

```
browser ─443─▶ caddy ─┬─▶ status.<LAB_DOMAIN> ─▶ uptime-kuma:3001  (Kuma's own login)
                      └─▶ home.<LAB_DOMAIN>   ─▶ homepage:3000     (allow-list only)
uptime-kuma ─┐
homepage ────┴─ tcp:2375 (internal network) ─▶ socket-proxy ─ro─▶ /var/run/docker.sock
uptime-kuma ─ HTTPS checks ─▶ caddy (PROXY_CADDY_IP) ─▶ each lab site
uptime-kuma ─ egress ─▶ Discord webhook
```

One Compose project, `name: lab-status`, three services. No service publishes
a host port; Caddy is the only way in.

### Networks

| Network | Kind | Members | Purpose |
|---|---|---|---|
| `proxy` | external `homelab-proxy` | uptime-kuma (alias `uptime-kuma`), homepage (alias `homepage`) | Caddy reaches the apps; Kuma reaches Caddy |
| `socket` | `internal: true` | socket-proxy, uptime-kuma, homepage | Docker API, unreachable from Caddy and from outside |
| `default` | bridge | uptime-kuma, homepage | Internet egress (Discord) and Homepage → Kuma API |

The aliases `uptime-kuma` and `homepage` must be unique on `homelab-proxy`.

### socket-proxy

- Image `lscr.io/linuxserver/socket-proxy`, pinned to the current release tag
  at implementation time.
- Mounts `/var/run/docker.sock:/var/run/docker.sock:ro`. **It is the only
  service that mounts the socket.**
- Environment: `CONTAINERS=1`, `POST=0`; every other API family left at its
  default `0`, except the defaults `PING`, `VERSION`, `EVENTS` (`1`). No
  `ALLOW_START/STOP/RESTARTS`, no `EXEC`, no `ALLOW_LOGS`.
- `read_only: true`, `tmpfs: [/run]`, `no-new-privileges`, memory limit 64M.
- Only on the `socket` network.

### uptime-kuma

- Image `louislam/uptime-kuma:2.5.5` (latest stable 2.x on 2026-10-05; recheck
  at implementation). Embedded SQLite, chosen in the first-run wizard.
- Named volume `kuma_data` at `/app/data` holds everything: the database,
  monitors, the Discord webhook URL and the admin account. It is the backup
  target and never enters git.
- `extra_hosts` maps every lab site name (`nettools`, `dashboard`, `foundry`,
  `sillytavern`, `st-uplink`, `npc-import`, `status`, `home`, each
  `.${LAB_DOMAIN}`) to `${PROXY_CADDY_IP}`. Checks then go straight to Caddy
  over `homelab-proxy` without depending on the VM's DNS or hairpin NAT. Kuma's
  source address is in `PROXY_SUBNET`, so `LAB_ALLOWED_CIDRS` must include it
  (the shipped default `172.16.0.0/12` does). Documented in `.env.example`.
- Trusts Caddy's internal CA: the exported root (`docs/TRUST.md` in
  homelab-proxy) is mounted read-only at `/certs/homelab-root.crt` with
  `NODE_EXTRA_CA_CERTS=/certs/homelab-root.crt`. Monitors never set "ignore
  TLS errors", so an expired or misissued certificate is reported as down.
- Settings → Reverse Proxy → Trust Proxy: **Yes** (manual first-run step).
- `no-new-privileges`, memory limit 512M, json-file log rotation as in
  homelab-proxy.

#### Monitors (configured in Kuma's UI after first start)

| Monitor | Type | Target |
|---|---|---|
| one per lab site | HTTP(s), 60 s | `https://<site>.<LAB_DOMAIN>/`, expect 2xx/3xx |
| one per container | Docker Container | container name, Docker host `lab` = `tcp://socket-proxy:2375` |

Container names come from `docker ps` on the VM at deploy time; the repo's
deploy doc lists them once confirmed. A Discord webhook notification is
created, set as the default, and applied to every monitor. One status page,
slug `lab`, groups the site monitors for Homepage's widget.

### homepage

- Image `ghcr.io/gethomepage/homepage:v2.4.0` (recheck at implementation).
- `./config` in the repo mounted read-only at `/app/config`;
  `LOG_TARGETS=stdout` so it never writes logs there. If the pinned version
  still needs a writable config directory, mount only `logs/` as a tmpfs.
- `HOMEPAGE_ALLOWED_HOSTS=home.${LAB_DOMAIN}`.
- `config/docker.yaml`: `lab: {host: socket-proxy, port: 2375}`.
- `config/services.yaml`: one tile per lab app with its HTTPS link,
  `server: lab`, `container: <name>` (live status, CPU, memory), plus a tile
  for Uptime Kuma itself with the `uptimekuma` widget (`url:
  http://uptime-kuma:3001`, `slug: lab`).
- `config/widgets.yaml`: `resources` (CPU, memory, disk `/`) for VM-wide use,
  plus a search/datetime header.
- `config/settings.yaml`: title "Lab", dark theme, no telemetry-type extras.
- Homepage has no login. It is reachable only through Caddy's LAN/VPN
  allow-list, holds no secrets, and gets read-only Docker data through the
  socket proxy.
- `no-new-privileges`, memory limit 256M, log rotation.

## Changes in homelab-proxy

- `sites/status.caddy` → `reverse_proxy uptime-kuma:3001` (WebSockets work
  through Caddy's default reverse proxy).
- `sites/home.caddy` → `reverse_proxy homepage:3000`.
- README site table rows; MINOR version bump and CHANGELOG entry per its
  `docs/VERSIONING.md`.
- Both files `import common` and use `{$LAB_DOMAIN}`, which its tests enforce.

## Repository layout (lab-status)

```
compose.yaml          three services, networks above
.env.example          LAB_DOMAIN, PROXY_CADDY_IP, HOMELAB_CA_ROOT (host path to root.crt)
config/               Homepage YAML
docs/DEPLOY.md        VM steps, first-run Kuma setup, monitor list, backup/restore
docs/VERSIONING.md    VERSION is the source of truth, semver, CHANGELOG per change
test/static.test.js   node --test static checks
AGENTS.md README.md VERSION CHANGELOG.md
```

Starts at `0.1.0`. Registered in the agent dashboard as project `lab-status`.

## Error handling and failure modes

- **Socket proxy down:** Kuma's container monitors and Homepage's container
  status fail visibly. HTTPS monitors keep working, so app outages are still
  caught.
- **Caddy down:** every HTTPS monitor fails and alerts, but Kuma's UI is
  unreachable too. Discord still gets the alert because Kuma's egress does not
  pass through Caddy.
- **Kuma itself down:** nothing alerts. Accepted for a homelab. A free external
  heartbeat is a possible later addition, not in this scope.
- **Discord webhook revoked:** Kuma shows notification errors in its UI. Fix
  the webhook there.

## Testing

`node --test test/` with Node's standard library only, matching homelab-proxy:

- No service in `compose.yaml` has `ports:`.
- `docker.sock` appears only under `socket-proxy`, and with `:ro`.
- socket-proxy sets `POST=0` and `CONTAINERS=1` and enables nothing else
  beyond the defaults.
- The `socket` network is `internal: true`; socket-proxy is not on `proxy`.
- Every `${VAR}` used in `compose.yaml` is documented in `.env.example`.
- Every image is pinned to a version tag, never `latest`.
- Homepage YAML: each service with `container:` names `server: lab`, and every
  link uses `https://` and the configured domain placeholder.
- A cross-repo check, when `../homelab-proxy` exists: `sites/status.caddy` and
  `sites/home.caddy` dial the aliases and ports defined here.

`docker compose config` runs as an extra check when Docker is installed (it is
not on the development PC). The live deployment, first-run setup and alert
test happen on the VM and are listed in `docs/DEPLOY.md` as manual steps. An
alert test is: stop one container, confirm Discord gets "down", start it again
and confirm "up".

## Out of scope

Cachet, public status pages, incident management, historical resource graphs,
log viewing (Dozzle), container control from the UI, and external
"monitor-the-monitor" heartbeats.
