# lab-status

A private ops view of the lab Docker VM, behind
[homelab-proxy](../homelab-proxy):

<!-- doc-media TODO
Kind: Homepage, Uptime Kuma and LibreNMS screenshots. Purpose: show the app launcher and monitoring views.
Capture acceptance: use synthetic service names and status history, omit host addresses, personal app links and notification settings, record image versions and date.
Blocker: live captures contain private service names and internal URLs; a sanitized representative capture meeting the acceptance above has not been prepared.
-->

| Site | App | What it shows |
|---|---|---|
| `status.<LAB_DOMAIN>` | Uptime Kuma | up/down and uptime history of every site and container; Discord alerts |
| `librenms.<LAB_DOMAIN>` | LibreNMS | network availability, SNMP health, interface graphs, Discord and Pixel alerts |
| `home.<LAB_DOMAIN>` | Homepage | links to every lab app, live container status, CPU and memory, VM resources |

```
caddy ─┬─▶ uptime-kuma:3001 ─┐
       └─▶ homepage:3000 ────┴─▶ socket-proxy:2375 (internal, read-only) ─▶ docker.sock
```

Only the socket proxy touches the Docker socket, and it allows nothing but
read-only container queries. No container publishes a port. Uptime Kuma keeps
its own login; Homepage is reachable only through homelab-proxy's LAN/VPN
allow-list.

[LibreNMS deployment and monitoring](docs/LIBRENMS.md) runs as a separate Compose project.

Prepared AI Server, Hermes and ComfyUI Homepage links and Kuma definitions are
source-only additions for VM103. They have no Docker badges and have not been
enrolled live. Follow the [AI entry activation steps](docs/DEPLOY.md#prepared-ai-service-entries-not-deployed)
with the matching proxy/control release before changing the running stack.

## Deploy

On the VM, after homelab-proxy 0.3.0 or later:

```sh
cp .env.example .env
docker compose build uptime-kuma   # from the fork checkout: see docs/DEPLOY.md
docker compose up -d
```

Then follow [docs/DEPLOY.md](docs/DEPLOY.md) for container names, Uptime Kuma's
first run, monitors, the alert test and backups.

## Test

```sh
node --test "test/*.test.js"
```

Node 20+ only. The version is in `VERSION` ([docs/VERSIONING.md](docs/VERSIONING.md)).

## Documentation

Start with the [documentation bundle](docs/index.md). Follow the
[OKF maintenance runbook](docs/OKF.md) when editing documentation.
