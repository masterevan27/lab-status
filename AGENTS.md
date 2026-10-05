# Agent instructions

## Dashboard

Dashboard project ID: lab-status

Check in with `GET DASHBOARD_BASE_URL/api/checkin?project=lab-status` before
work and record results through `POST DASHBOARD_BASE_URL/api/checkin/lab-status/events`.
The protocol is `G:\GIT-REPOS\ai-agent-dashboard\data\README.md`.

## Working in this repository

- Run `node --test test/`. Set `HOMELAB_PROXY_DIR` to a homelab-proxy checkout
  (for example a worktree) to run the cross-repo checks against it; otherwise
  they use the nearest sibling `homelab-proxy` folder, or skip.
- Keep the YAML plainly formatted (two-space indents, one key per line): the
  tests read it as text.
- Only `socket-proxy` may mount the Docker socket, read-only, with
  `CONTAINERS=1` and `POST=0` and nothing else. Never give an app the socket.
- A site added to or removed from homelab-proxy's `sites/` needs the same change
  in Uptime Kuma's `extra_hosts`, a Homepage tile and a Kuma monitor.
- Pin every image to a version tag. Back up `kuma_data` before upgrading Kuma.
- Never commit `.env`, certificates, Kuma backups, or the Discord webhook URL.

## Release versioning

Read [`docs/VERSIONING.md`](docs/VERSIONING.md) before completing work.
