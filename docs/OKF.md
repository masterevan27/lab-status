---
type: Runbook
title: Maintain OKF documentation
description: Install the pinned tools, check documentation and maintain bundle navigation and scope.
---
# Maintain OKF documentation

This project uses house profile 1.0.0 and OKF 0.2. The repository-owned
[profile](../.okf/tools/profile.md) and [lock](../.okf/tools/profile.json) define
the pinned policy; `.okf/tools` contains its self-contained runtime snapshot.

CI uses `actions/checkout@v7`, `actions/setup-node@v7` and Node 24.

## Install and validate

From the repository root with Node 20.19 or later:

```sh
npm ci --prefix .okf/tools --ignore-scripts --no-audit --no-fund
node .okf/tools/cli.mjs index .
node .okf/tools/cli.mjs check .
node .okf/check-external.mjs
```

Preserve document paths and unknown metadata. Every concept in `docs/` requires
`type`, `title` and `description`. The root index has only `okf_version`
frontmatter; nested indexes have none. The index command refreshes only marked
generated indexes; maintain handwritten indexes manually. CI installs and checks
the same pinned runtime. Review tool upgrades as explicit repository changes.

## Documentation outside the bundle

The paths below are preserved. The pinned checker validates `docs/`; external
concept metadata and links are checked by `.okf/check-external.mjs` locally and in CI. Root and nested README
files and agent instructions retain their existing formats.

Maintained concepts converted in place:

- [CHANGELOG.md](../CHANGELOG.md) — retains its existing path and prose, with concept metadata.

Entry points and instructions outside bundle conformance:

- [README.md](../README.md) — existing entry point or repository instructions.
- [AGENTS.md](../AGENTS.md) — existing entry point or repository instructions.

## Review boundaries

Metadata and local-link validation establish structural conformance, not factual
review, live deployment or completion of a historical plan. Existing implementation
notes and validation gaps remain authoritative context; the dashboard owns task,
test and roadmap state. Do not infer completed work from document lifecycle
metadata, invent verification actors or renew freshness dates without evidence.
