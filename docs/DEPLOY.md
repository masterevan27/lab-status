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
  which is the default `HOMELAB_CA_ROOT`.

## 2. Confirm container names

```sh
docker ps --format '{{.Names}}' | sort
```

Compare the list with `config/services.yaml`:

- Fix any `container:` name that differs.
- Foundry, SillyTavern and NPC import ship without `container:` because their
  compose files live only on the VM. Add `server: lab` and `container: <name>`
  under each.

Commit those edits so the repository matches the VM.

## 3. Start

```sh
cp .env.example .env          # check LAB_DOMAIN, PROXY_CADDY_IP, HOMELAB_CA_ROOT
docker compose up -d
docker compose ps             # three services running; uptime-kuma and homepage healthy
docker compose logs homepage | tail -n 20
```

Homepage must not log a read-only or permission error. If it names a file,
create that file empty in `config/` and add it to the test's `HOMEPAGE_FILES`.

## 4. Uptime Kuma first run

Open `https://status.<LAB_DOMAIN>`:

1. Choose **SQLite** and create the admin account. Keep the password in your
   password manager.
2. **Settings → Reverse Proxy → Trust Proxy: Yes.**
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
   | dashboard | HTTP(s) | `https://dashboard.<LAB_DOMAIN>/` |
   | foundry | HTTP(s) | `https://foundry.<LAB_DOMAIN>/` |
   | sillytavern | HTTP(s) | `https://sillytavern.<LAB_DOMAIN>/` |
   | npc-import | HTTP(s) | `https://npc-import.<LAB_DOMAIN>/` |
   | home | HTTP(s) | `https://home.<LAB_DOMAIN>/` |
   | each container from step 2 except `lab-status-uptime-kuma-1` | Docker Container | its name, Docker host `lab` |

   `st-uplink` is a plugin listener without a page of its own; the SillyTavern
   container monitor covers it.
6. **Status Pages → New Status Page:** name `Lab`, slug `lab`. Add the HTTP(s)
   monitors and save. Homepage's Uptime Kuma tile reads this page.

## 5. Check

- `https://home.<LAB_DOMAIN>` shows every tile. Container tiles show running
  with CPU and memory, and the Uptime Kuma tile shows up/down counts.
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

Back up `kuma_data`, change the image tag in `compose.yaml`, bump `VERSION` and
`CHANGELOG.md`, then:

```sh
docker compose pull
docker compose up -d
```
