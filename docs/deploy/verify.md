---
type: Runbook
title: Check the deployment
description: Confirm Homepage, the dashboard readiness monitor and Discord alerts work after a deployment.
status: draft
tags:
  - deployment
  - operations
sources:
  - id: settings
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/config/settings.yaml
    title: Homepage settings
  - id: static-test
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/test/static.test.js
    title: Configuration consistency tests
generated:
  by: claude-code/claude-sonnet-5-5
  at: 2026-11-13T00:00:00Z
stale_after: 2027-01-09T00:00:00Z
---
# Check the deployment

Run these checks after the monitors exist.

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

## Related

- [Deploy on the lab VM](../DEPLOY.md) - ordered procedure and deployment records.
- [Add monitors and the status page](kuma-monitors.md) - the previous step.
- [Back up and restore Uptime Kuma](backup-restore.md) - take a backup once it works.
