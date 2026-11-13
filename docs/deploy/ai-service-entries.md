---
type: Runbook
title: AI service entries
description: Record of the AI Server, Hermes and ComfyUI Homepage links and Uptime Kuma monitors deployed on 2026-10-26.
status: draft
tags:
  - deployment
  - monitoring
  - operations
sources:
  - id: ai-control-source
    resource: ../../config/ai-monitors.json
    title: Prepared AI service integration
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
# AI service entries

Homepage links and credential-free Kuma monitor definitions for the VM103 AI services, deployed 2026-10-26.

Homepage has AI Server, Hermes and ComfyUI links for VM103; these have no Docker container badges. `config/ai-monitors.json` is a credential-free definition file for manual Kuma enrollment, not an automatically imported database. Compose maps all three site names to Caddy through `extra_hosts`.

After separate deployment authorization and proxy/native-auth acceptance, enroll the three HTTPS monitors from that file using the current LAB_DOMAIN, verified CA and expected status codes. `/healthz` reports control-process liveness only; a 200 response does not establish GPU readiness. Hermes root accepts a login page/redirect/401; confirm that the native auth gate is engaged separately. ComfyUI root checks editor reachability, not generation. Keep usernames, cookies, CSRF tokens and native passwords out of monitor exports. Back up Kuma before edits and retain monitor IDs for rollback; remove only the three newly created monitors if reversing this change.

The source task performed no live changes. The later owner-authorized deployment
updated VM101 to status 2.1.0 and recreated Kuma with the new extra_hosts, using
the existing locally built image. The three monitors are enrolled as 27/28/29
and each returned 200 through verified TLS. The existing Homepage config mount
now contains the three links. No notification destination or existing monitor
was edited, and no notification delivery test is claimed.

Before enrollment, the running SQLite database was backed up with VACUUM INTO:
`/app/data/kuma-before-ai-control-20261026.sqlite`; a mode 0600 copy is retained
on VM101 at `/home/edekalb/ai-control-deploy-20261026/kuma-before.sqlite`.
These contain private configuration and must never be committed.
Full scoped evidence is in homelab-infra
`review-evidence/2026-10-26-ai-control-live.md`. Physical thin-pool monitoring
remains a separate request.

## Related

- [Deploy on the lab VM](../DEPLOY.md) - ordered procedure and deployment records.
- [Add monitors and the status page](kuma-monitors.md) - the monitor list these entries extend.
- [Proxmox, TensorBoard and host monitors](proxmox-host-monitors.md) - the later monitor deployment.
