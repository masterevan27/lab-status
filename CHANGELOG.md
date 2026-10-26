---
type: Reference
title: Changelog
description: Recorded project releases and the changes included in each release.
generated:
  by: codex/unrecorded
  at: 2026-10-26T06:32:12.169705Z
sources:
  - id: ai-control-source
    resource: config/ai-monitors.json
    title: Prepared AI monitor definitions
  - id: readme-preview
    resource: README.md
    title: README deliverable preview
---
# Changelog

## 2.1.0 — 2026-10-26

- Add source-only AI Server, Hermes and ComfyUI Homepage links, Kuma host mappings and credential-free monitor definitions. VM103 services have no Docker badges; live enrollment and activation remain pending.

## 2.0.0 — 2026-10-25

- Add the separate LibreNMS Docker stack, six network health/link/outage rules, Discord and direct Pixel delivery, and independent Kuma container checks. The new stack has its own environment variables and persistent volumes. Preserve the pending sanitized README preview and telemetry/rotation limits.

## 1.4.2 — 2026-10-24

- Record the README capture requirements and blocker; the real product capture remains pending.

## 1.4.1 — 2026-10-22

- The deploy guide cites its sources at the 1.4.0 commit, which includes the
  netmap, PhotoPrism and FileBrowser entries it describes. No behaviour change.

## 1.4.0 — 2026-10-22

- Add FileBrowser (`files.<LAB_DOMAIN>`, homelab-proxy 0.6.0): Uptime Kuma
  resolves it to Caddy, Homepage has a FileBrowser tile, and the deploy guide
  lists its HTTP(s) monitor. It runs on the Raspberry Pi files.spiralfrenzy.com,
  so neither the tile nor Kuma has a container check for it.

## 1.3.0 — 2026-10-20

- Add PhotoPrism (`photoprism.<LAB_DOMAIN>`, homelab-proxy 0.5.0): Uptime
  Kuma resolves it to Caddy, Homepage has a PhotoPrism tile, and the deploy
  guide lists its HTTP(s) monitor. It runs on its own VM, so neither the tile
  nor Kuma has a container check for it.

## 1.2.3 — 2026-10-20

- Monitor the agent dashboard at `/api/ready` (ai-agent-dashboard 0.11.1 or
  later) instead of its page, accepting only `200-299`. The page kept
  answering while the dashboard couldn't rebuild its data, so an outage looked
  up. Upgrade the dashboard, then edit the existing `dashboard` monitor's URL
  and accepted codes in Uptime Kuma.

## 1.2.2 — 2026-10-20

- Record OKF lifecycle, tags, provenance, code sources and review deadlines in
  every documentation concept, and adopt house profile 1.1.0, which warns when
  provenance, runbook sources or review deadlines are missing. No document is
  marked verified.

## 1.2.1 — 2026-10-18

- Ignore local `.obsidian/` editor settings in Git.

## 1.2.0 — 2026-10-11

- Add network-scan-and-map, served by homelab-proxy at `netmap.<LAB_DOMAIN>`:
  Uptime Kuma resolves the site to Caddy, Homepage gains a **Network map**
  tile with live container status, and the deploy guide lists its HTTP(s)
  and Docker container monitors. Recreate Uptime Kuma to apply the host entry,
  then add the two monitors and put the HTTP(s) one on the `Lab` status page.

## 1.1.1 — 2026-10-11

- The Agent dashboard tile reads live status from container
  `ai-agent-dashboard`, its name from ai-agent-dashboard 0.8.10 on (previously
  `docker-dashboard-1`).

## 1.1.0 — 2026-10-10

- The status page's uptime range selector gains 1, 3 and 5 hours, and the
  heartbeat bar now covers the chosen range instead of the last 100 checks
  (image `2.5.5-range.2`).

## 1.0.0 — 2026-10-10

- Build Uptime Kuma from a fork that adds an **Uptime range** selector to the
  status page (24 hours by default; 7 days, 30 days or 1 year), pending
  upstream issue #986. Needs the fork checkout at `KUMA_SRC` and
  `docker compose build uptime-kuma` on the VM.

## 0.1.4 — 2026-10-09

- Document the test command as `node --test "test/*.test.js"`; the directory form fails on Node 22.

## 0.1.3 — 2026-10-09

- Keep Homepage's light/dark and color controls available by leaving theme and color unset.
- Add the confirmed Foundry, SillyTavern and NPC import container names for live statistics.
- Update deployment instructions to match the verified VM configuration.

## 0.1.2 — 2026-10-09

- Use checkout v7, setup-node v7 and Node 24 for CI.

## 0.1.1 — 2026-10-05

- Adopt the pinned OKF documentation profile, metadata, indexes and dedicated CI check.

## 0.1.0 — 2026-10-05

- Uptime Kuma 2.5.5 at `status.<LAB_DOMAIN>`: HTTPS checks through Caddy with
  the homelab CA, container checks through the socket proxy, Discord alerts.
- Homepage v2.4.0 at `home.<LAB_DOMAIN>`: links to every lab app with live
  container status, CPU and memory, VM-wide resources, and an Uptime Kuma summary.
- Read-only Docker socket proxy on an internal network; no published ports.
- VM deployment, first-run setup, alert test and backup guide.
