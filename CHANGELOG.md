---
type: Reference
title: Changelog
description: Recorded project releases and the changes included in each release.
---
# Changelog

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
