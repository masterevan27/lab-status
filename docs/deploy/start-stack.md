---
type: Runbook
title: Confirm names and start the stack
description: Match the Homepage container names to the VM, then build and start the three services.
status: draft
tags:
  - deployment
  - operations
sources:
  - id: compose
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/compose.yaml
    title: Uptime Kuma, Homepage and socket proxy services
  - id: env-example
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/.env.example
    title: Deployment environment variables
  - id: services
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/config/services.yaml
    title: Homepage tiles and container names
  - id: static-test
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/test/static.test.js
    title: Configuration consistency tests
generated:
  by: claude-code/claude-sonnet-5-5
  at: 2026-11-13T00:00:00Z
stale_after: 2027-01-09T00:00:00Z
---
# Confirm names and start the stack

Compare `config/services.yaml` with the running containers, then start the stack with Docker Compose.

## Confirm container names

```sh
docker ps --format '{{.Names}}' | sort
```

Compare the list with `config/services.yaml`:

- Fix any `container:` name that differs.
- Foundry, SillyTavern and NPC import use the names confirmed on sfdockerhost1:
  `foundry-v13`, `sillytavern` and `lancer-import-gui`. Update them if your VM
  uses different names.

Commit those edits so the repository matches the VM.

## Start


```sh
cp .env.example .env          # check LAB_DOMAIN, PROXY_CADDY_IP, HOMELAB_CA_ROOT, KUMA_SRC
docker compose build uptime-kuma   # several minutes: npm install and frontend build
docker compose up -d
docker compose ps             # three services running; uptime-kuma and homepage healthy
docker compose logs homepage | tail -n 20
```

Homepage must not log a read-only or permission error. If it names a file,
create that file empty in `config/` and add it to the test's `HOMEPAGE_FILES`.

## Related

- [Deploy on the lab VM](../DEPLOY.md) - ordered procedure and deployment records.
- [Deploy prerequisites](prerequisites.md) - the previous step.
- [Uptime Kuma first run](kuma-first-run.md) - the next step.
