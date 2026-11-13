---
type: Runbook
title: Upgrade and the Uptime Kuma image
description: Upgrade the forked Uptime Kuma image and understand why it is built from a fork checkout.
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
  - id: kuma-dockerfile
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/kuma/Dockerfile
    title: Uptime Kuma fork image build
generated:
  by: claude-code/claude-sonnet-5-5
  at: 2026-11-13T00:00:00Z
stale_after: 2027-01-09T00:00:00Z
---
# Upgrade and the Uptime Kuma image

Rebase the Uptime Kuma fork onto a new upstream tag and rebuild the local image.

## Upgrade

Back up `kuma_data`. Uptime Kuma is built from the fork, so rebase its
`feat/status-page-time-range` branch onto the new upstream tag, change the
local tag in `compose.yaml` (`2.5.5-range.2` becomes `<tag>-range.1`), bump
`VERSION` and `CHANGELOG.md`, then:

```sh
docker compose pull --ignore-buildable
docker compose build uptime-kuma
docker compose up -d
```

Once an upstream release includes the selector, set `image:` back to
`louislam/uptime-kuma:<tag>`, drop `build:` and `kuma/Dockerfile`, and remove
`KUMA_SRC`.

## Uptime Kuma image


Upstream Uptime Kuma shows only the 24-hour uptime on a status page and has no
range control ([uptime-kuma#986](https://github.com/louislam/uptime-kuma/issues/986)).
`kuma/Dockerfile` builds the image from a fork checkout instead: the `src`
build context in `compose.yaml`, `KUMA_SRC`, default `../uptime-kuma`. The
fork's `feat/status-page-time-range` branch is upstream 2.5.5 plus the commits
that add the selector and are meant to become an upstream pull request. The
Dockerfile mirrors the release stage of upstream's `docker/dockerfile` and adds
the frontend build that upstream's release pipeline runs beforehand.

## Related

- [Deploy on the lab VM](../DEPLOY.md) - ordered procedure and deployment records.
- [Back up and restore Uptime Kuma](backup-restore.md) - back up first.
- [Deploy prerequisites](prerequisites.md) - the fork checkout requirement.
