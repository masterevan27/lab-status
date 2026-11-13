---
type: Runbook
title: Back up and restore Uptime Kuma
description: Back up and restore the kuma_data volume that holds every Uptime Kuma setting and secret.
status: draft
tags:
  - deployment
  - operations
sources:
  - id: compose
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/compose.yaml
    title: Uptime Kuma, Homepage and socket proxy services
generated:
  by: claude-code/claude-sonnet-5-5
  at: 2026-11-13T00:00:00Z
stale_after: 2027-01-09T00:00:00Z
---
# Back up and restore Uptime Kuma

Back up the `lab-status_kuma_data` volume before any change and restore it from the archive if one goes wrong.

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

## Related

- [Deploy on the lab VM](../DEPLOY.md) - ordered procedure and deployment records.
- [Upgrade and the Uptime Kuma image](upgrade.md) - back up before upgrading.
- [Check the deployment](verify.md) - the previous step.
