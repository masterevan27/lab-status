---
type: Plan
title: Network monitoring implementation
description: Deploy LibreNMS and independent Home Assistant reachability alerts.
status: draft
tags: [monitoring, deployment]
generated:
  by: codex/unrecorded
  at: 2026-10-25T22:35:00Z
---
# Network monitoring implementation

Owner-approved scope: LibreNMS on the existing Docker VM, Home Assistant Green
as an independent watchdog for the Docker VM, Proxmox2 and core gateway.
No VM resize, firmware update, routing/VLAN changes or host restart.

1. Verify host capacity, access, current devices and existing notification targets.
2. Deploy a separate Compose project from `librenms/compose.yaml`, with pinned
   web/dispatcher/database/Redis images, persistent data and no published ports.
3. Add `librenms` to Caddy, Homepage and Kuma. Verify login and verified HTTPS.
4. Configure source-restricted read-only SNMPv3 for reachable RouterOS devices;
   use availability monitoring where telemetry access is unavailable.
5. Send network faults/recovery to the existing Discord destination. Verify
   device polling, graphs, transport delivery and bounded alert delays.
6. Add HA ping sensors, latched phone/persistent outage and recovery alerts;
   suppress downstream alerts while parents are down. Test without stopping devices.
7. Update affected deployment/inventory/HA documentation, run repository checks,
   request independent review, record evidence and limitations. Do not land/push.

Pending constraints: credential storage approval; unavailable old living-room
switch; UniFi/Fortinet telemetry credentials may require owner steps.
Live outage tests must use disposable synthetic targets, never interrupt the home network.
