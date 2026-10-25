# Monitoring documentation sweep and local landing — 2026-10-25

Reviewer: codex/unrecorded. Scope: the monitoring task only, across lab-status,
home-assistant, homelab-proxy and the isolated homelab-infra landing worktree.
The retained release commits and project-relative source/evidence paths recover
the reviewed contents. No whole-document freshness or physical-outage claim.

Corrections: owner-confirmed original Pixel receipt; dated initial device/ping
observations; direct Pixel bridge in the architecture; matching LibreNMS site
in proxy diagram, service inventory and deployment monitor table; explicit
Discord webhook incident wording; source and supported tag metadata. Current
code, sanitized saved configurations and setup traces support these claims.

README media: proxy/inventory diagrams remain applicable. lab-status/HA still
lack accepted sanitized screenshots; TODO acceptance remains open. Live setup
captures contain private hostnames/internal URLs and are not tracked. This is
unfinished preview work, not compliance or a claim that capture is impossible.

The isolated inventory branch contains only monitoring sections/source entries,
its evidence and release files, extracted from the shared checkout without
modifying it. CSS610 preparation/cutover and Fortinet audit changes remain there.

Existing seven HA warnings are partial-review/freshness/source limitations,
not structural errors. No stale_after was renewed. No backup restore, external
heartbeat, WAN/power failure or physical outage test was added. Discord webhook
rotation and deeper non-RouterOS telemetry remain separate owner/access work.

Individual commands, runtimes, exit codes and relevant outputs are retained in
homelab-infra/secrets/monitoring/land/checks.json and the landed dashboard
closeouts. Live setup acceptance is retained in the setup evidence, not inferred
from structural tests. No push is authorized or performed.
