---
type: Runbook
title: Maintain OKF documentation
description: Install the pinned tools, check documentation and maintain bundle navigation and scope.
status: stable
tags:
  - documentation
sources:
  - id: okf-profile
    resource: ../.okf/tools/profile.md
    title: House documentation profile
  - id: okf-lock
    resource: ../.okf/tools/profile.json
    title: Pinned profile and specification revision
  - id: okf-config
    resource: ../.okf.json
    title: Bundle configuration
  - id: okf-external
    resource: ../.okf/check-external.mjs
    title: External concept checker
  - id: okf-workflow
    resource: ../.github/workflows/okf.yml
    title: Documentation CI workflow
  - id: okf-spec
    resource: https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/0b87c52c6ef999286c745e19998fdfcd03d5dbee/SPEC.md
    title: Open Knowledge Format v0.2 specification
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-20T05:06:43Z
stale_after: 2027-01-18T00:00:00Z
---
# Maintain OKF documentation

This project uses house profile 1.1.0 and OKF 0.2. The repository-owned
[profile](../.okf/tools/profile.md) and [lock](../.okf/tools/profile.json) define
the pinned policy; `.okf/tools` contains its self-contained runtime snapshot.
Profile 1.1.0 warns when a concept lacks `generated` or a runbook lacks
`sources` or `stale_after`; warnings keep the check passing, but treat them as
review work.

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

## Metadata conventions

Every concept carries `status`, `tags` and `generated`, in addition to the
required keys. Only record what evidence supports.

- `status`: `draft` while a document is still an unapproved proposal, `stable`
  otherwise, `deprecated` once replaced (link the replacement). It never records
  whether the described work shipped; the dashboard carries implementation
  state.
- `tags`: choose from `architecture`, `deployment`, `documentation`,
  `monitoring`, `operations` and `versioning`. Extend this list here before
  using a new tag.
- `generated`: `by` names the agent that wrote the current content, as
  `AGENT/model-id`, `codex/unrecorded` or `claude-code/unrecorded` when the
  producer version was not recorded, or `human:masterevan27` for hand-written
  content. `at` is the last meaningful content change; metadata-only edits do
  not move it.
- `sources`: runbooks and references cite the code, scripts and configuration
  they describe as GitHub URLs pinned to the commit the content was written
  against. When the cited file changes in the same commit as the document, use a
  relative path instead, because that commit does not exist yet. Refresh sources
  when the content is next revised. Plans and designs rely on their links
  instead and have no review deadline.
- `stale_after`: runbooks, operational references, this guide and VERSIONING use
  90 days after `generated.at`. When the deadline passes, check the content
  against its sources, then revise or verify it before moving the date.
- `verified`: add `{ by: human:masterevan27, at: ... }` only after the owner
  actually reviewed the content, or an agent entry only after an agent checked
  it against its sources. The 2026-10-20 metadata backfill recorded no
  verification.

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
