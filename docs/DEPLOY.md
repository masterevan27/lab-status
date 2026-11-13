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
  - id: ai-control-source
    resource: ../config/ai-monitors.json
    title: Prepared AI service integration
  - id: network-monitoring-20261025
    resource: LIBRENMS.md
    title: LibreNMS deployment and evidence
  - id: compose
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/compose.yaml
    title: Uptime Kuma, Homepage and socket proxy services
  - id: env-example
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/.env.example
    title: Deployment environment variables
  - id: services
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/config/services.yaml
    title: Homepage tiles and container names
  - id: settings
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/config/settings.yaml
    title: Homepage settings
  - id: kuma-dockerfile
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/kuma/Dockerfile
    title: Uptime Kuma fork image build
  - id: static-test
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/test/static.test.js
    title: Configuration consistency tests
generated:
  by: claude-code/claude-sonnet-5-5
  at: 2026-11-13T00:00:00Z
stale_after: 2027-01-09T00:00:00Z
---
# Deploy on the lab VM

Deploy the lab monitoring stack on the VM that hosts homelab-proxy (Docker
Engine, Compose 2.24.4 or later), from this repository's checkout.

## Procedure

Follow these pages in order for a first deployment:

| Step | Page | What it covers |
|---|---|---|
| 1 | [Deploy prerequisites](deploy/prerequisites.md) | homelab-proxy, allow-list, root certificate and the Uptime Kuma fork checkout |
| 2 | [Confirm names and start the stack](deploy/start-stack.md) | container names in `config/services.yaml`, `.env`, build and start |
| 3 | [Uptime Kuma first run](deploy/kuma-first-run.md) | admin account, Docker host and Discord notification |
| 4 | [Add monitors and the status page](deploy/kuma-monitors.md) | the monitor list and the `lab` status page |
| 5 | [Check the deployment](deploy/verify.md) | tiles, readiness endpoint and the alert test |

Operate the running stack with:

| Task | Page |
|---|---|
| Back up or restore `kuma_data` | [Back up and restore Uptime Kuma](deploy/backup-restore.md) |
| Upgrade Uptime Kuma, or understand the fork image | [Upgrade and the Uptime Kuma image](deploy/upgrade.md) |

## Network hardware monitoring

LibreNMS now runs as a separate Compose project on this VM. See
[Network monitoring](LIBRENMS.md) for its devices, credentials locations, alerts,
operation and recovery limits. Kuma monitor 22 watches its HTTPS login page.

## AI service entries (deployed 2026-10-26)

Homepage has AI Server, Hermes and ComfyUI links for VM103, and Kuma monitors
27/28/29 are enrolled. See [AI service entries](deploy/ai-service-entries.md)
for the liveness, login and editor checks and the rollback notes.

## Proxmox, TensorBoard and host monitors (deployed 2026-11-13)

Monitors 30-38 and the Infrastructure status page group were added to Kuma. See
[Proxmox, TensorBoard and host monitors](deploy/proxmox-host-monitors.md) for the
list, the backup taken before the change and how to reverse it.

## Related

- [Network monitoring with LibreNMS](LIBRENMS.md) - the separate network monitoring stack.
- [Remote access with Tailscale](TAILSCALE.md) - the separate remote-access stack.
- [Versioning](VERSIONING.md) - bump `VERSION` and `CHANGELOG.md` for each change.
