---
type: Runbook
title: Add monitors and the status page
description: Add the Uptime Kuma monitors for every lab site and container and publish the Lab status page that Homepage reads.
status: draft
tags:
  - deployment
  - monitoring
  - operations
sources:
  - id: services
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/config/services.yaml
    title: Homepage tiles and container names
  - id: static-test
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/test/static.test.js
    title: Configuration consistency tests
  - id: network-monitoring-20261025
    resource: ../LIBRENMS.md
    title: LibreNMS deployment and evidence
generated:
  by: claude-code/claude-sonnet-5-5
  at: 2026-11-13T00:00:00Z
stale_after: 2027-01-09T00:00:00Z
---
# Add monitors and the status page

Add the HTTP, TCP and Docker monitors, then build the `lab` status page that Homepage reads.

## Add the monitors

Add these monitors. HTTP(s) monitors: interval 60 s, accepted status
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
| files | HTTP(s) | `https://files.<LAB_DOMAIN>/health` (runs on the Raspberry Pi, so it has no Docker Container monitor) |
| tensorboard | HTTP(s) | `https://tensorboard.<LAB_DOMAIN>/` (runs on VM 104 rl-hoh, so it has no Docker Container monitor) |
| proxmox2, proxmox | HTTP(s) | `https://proxmox2.<LAB_DOMAIN>/`, `https://proxmox.<LAB_DOMAIN>/` (the Proxmox VE login pages) |
| HA Green | HTTP(s) | `https://home.spiralfrenzy.com:8123/manifest.json` (Home Assistant serves its own HTTPS and is not behind the proxy) |
| Pi Samba, Pi NFS, Proxmox QDevice | TCP Port | `10.8.30.63` ports `445`, `2049` and `5403` (`corosync-qnetd`). A listening port does not prove the share mounts or that the cluster counts the vote; `pvecm status` does |
| `librenms` | HTTP(s) | `https://librenms.<LAB_DOMAIN>/login` (200-299, two retries; see [network monitoring](../LIBRENMS.md)) |
| each container confirmed in [the container-name step](start-stack.md) except `lab-status-uptime-kuma-1`, plus `ai-agent-dashboard` and `tailscale-tailscale-1` | Docker Container | its name, Docker host `lab` |

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

## Create the Lab status page

**Status Pages → New Status Page:** name `Lab`, slug `lab`. Add the HTTP(s)
monitors (AI and TensorBoard under Lab apps; LibreNMS, Proxmox, HA Green and
the Pi port checks in an Infrastructure group) and save. Homepage's Uptime Kuma tile reads this page.
The **Uptime range** selector above the list sets both the uptime
percentage and the heartbeat bar: 24 hours when first opened, or 1, 3 or
5 hours, 7 days, 30 days or 1 year. The bar shows the range as equal
buckets; a yellow bucket had both up and down checks, and its tooltip
gives the counts. The browser remembers the choice per page.

## Related

- [Deploy on the lab VM](../DEPLOY.md) - ordered procedure and deployment records.
- [Uptime Kuma first run](kuma-first-run.md) - the previous step.
- [Check the deployment](verify.md) - the next step.
- [Network monitoring with LibreNMS](../LIBRENMS.md) - the `librenms` monitor.
