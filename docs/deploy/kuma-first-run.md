---
type: Runbook
title: Uptime Kuma first run
description: Claim the Uptime Kuma admin account, connect the Docker host and set up the Discord notification.
status: draft
tags:
  - deployment
  - monitoring
  - operations
sources:
  - id: compose
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/compose.yaml
    title: Uptime Kuma, Homepage and socket proxy services
  - id: static-test
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/test/static.test.js
    title: Configuration consistency tests
generated:
  by: claude-code/claude-sonnet-5-5
  at: 2026-11-13T00:00:00Z
stale_after: 2027-01-09T00:00:00Z
---
# Uptime Kuma first run

Create the Uptime Kuma admin account before anyone else can, then connect the Docker host and Discord.

Until an admin account exists, Uptime Kuma's setup page is open to every
client in `LAB_ALLOWED_CIDRS`, and whoever reaches it first becomes the admin.
Do the first item below straight away after `docker compose up -d`. If others share your LAN
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

## Related

- [Deploy on the lab VM](../DEPLOY.md) - ordered procedure and deployment records.
- [Confirm names and start the stack](start-stack.md) - the previous step.
- [Add monitors and the status page](kuma-monitors.md) - the next step.
