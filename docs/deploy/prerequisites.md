---
type: Runbook
title: Deploy prerequisites
description: Confirm the proxy, allow-list, certificate and Uptime Kuma fork checkout that the stack needs before it starts.
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
  - id: static-test
    resource: https://github.com/masterevan27/lab-status/blob/a185faa71074af7b8d702fa93d57f7c934c65b33/test/static.test.js
    title: Configuration consistency tests
generated:
  by: claude-code/claude-sonnet-5-5
  at: 2026-11-13T00:00:00Z
stale_after: 2027-01-09T00:00:00Z
---
# Deploy prerequisites

Check these conditions on the VM before starting the stack.

- homelab-proxy 0.3.0 or later is running. It creates the `homelab-proxy`
  network and serves the `status` and `home` sites.
- homelab-proxy's `LAB_ALLOWED_CIDRS` includes its `PROXY_SUBNET`. The shipped
  default `172.16.0.0/12` covers `172.31.250.0/24`. If you narrow the list, add
  the proxy subnet back, or Caddy refuses every Uptime Kuma check and all sites
  show down.
- homelab-proxy's root certificate is on the VM. Its `docs/TRUST.md` Linux step
  installs it at `/usr/local/share/ca-certificates/homelab-proxy-root.crt`,
  which is the default `HOMELAB_CA_ROOT`. Check it is a file:

  ```sh
  test -f /usr/local/share/ca-certificates/homelab-proxy-root.crt && echo ok
  ```

  Compose refuses to start Uptime Kuma if the file is missing.
- A checkout of the Uptime Kuma fork, branch `feat/status-page-time-range`,
  next to this repository as `../uptime-kuma`, or at the path set in `KUMA_SRC`.
  Compose builds Uptime Kuma from it: see [Uptime Kuma image](upgrade.md#uptime-kuma-image).

## Related

- [Deploy on the lab VM](../DEPLOY.md) - ordered procedure and deployment records.
- [Confirm names and start the stack](start-stack.md) - the next step.
- [Upgrade and the Uptime Kuma image](upgrade.md) - why the fork checkout is needed.
