---
type: Runbook
title: Proxmox, TensorBoard and host monitors
description: Record of the Proxmox, TensorBoard, host and container monitors deployed on 2026-11-13, with rollback steps.
status: draft
tags:
  - deployment
  - monitoring
  - operations
sources:
  - id: compose
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/compose.yaml
    title: Uptime Kuma, Homepage and socket proxy services
  - id: services
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/config/services.yaml
    title: Homepage tiles and container names
generated:
  by: claude-code/claude-sonnet-5-5
  at: 2026-11-13T00:00:00Z
stale_after: 2027-01-09T00:00:00Z
---
# Proxmox, TensorBoard and host monitors

Monitors 30-38 and the Infrastructure status page group, deployed 2026-11-13.

VM101 was fast-forwarded to homelab-proxy 0.11.0 and lab-status 2.3.0 from
local bundles; Caddy and Kuma were recreated for the new mount and
`extra_hosts`. Monitors 30–38 were added to the Kuma database while it ran and
loaded on the recreate: tensorboard, proxmox2, proxmox, the `ai-agent-dashboard`
and `tailscale-tailscale-1` containers, HA Green, and the Pi's Samba, NFS and
QDevice ports. Each sends to the existing Discord notification. Monitors 27–30
were added to Lab apps on the `lab` status page, and a new Infrastructure group
(id 4) holds 22, 31, 32 and 35–38. First checks: all up except proxmox (502:
that node was offline). Monitors 27–29 still have no notification.

Backup before the change: `/app/data/kuma-before-monitors-20261113.sqlite`, with
a mode 0600 copy at `~/lab-deploy-20261113/kuma-before.sqlite` on VM101; never
commit either. To reverse, delete monitors 30–38, group 4 and the four Lab apps
`monitor_group` rows (27–30), or restore the backup while Kuma is stopped.

## Related

- [Deploy on the lab VM](../DEPLOY.md) - ordered procedure and deployment records.
- [Add monitors and the status page](kuma-monitors.md) - the monitor list.
- [AI service entries](ai-service-entries.md) - the earlier monitor deployment.
- [Back up and restore Uptime Kuma](backup-restore.md) - restoring a backup.
