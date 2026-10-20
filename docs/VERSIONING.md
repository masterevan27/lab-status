---
type: Reference
title: Versioning
description: Authoritative release version source and project-specific version
  change procedure.
status: stable
tags:
  - documentation
  - versioning
sources:
  - id: version
    resource: ../VERSION
    title: Machine-readable version source
  - id: changelog
    resource: ../CHANGELOG.md
    title: Release changelog
  - id: version-test
    resource: ../test/static.test.js
    title: VERSION and CHANGELOG agreement test
generated:
  by: claude-code/claude-sonnet-5-5
  at: 2026-10-09T23:11:25Z
stale_after: 2027-01-07T00:00:00Z
---
# Versioning

- The root `VERSION` file is the single source of truth.
- Semantic versioning: MAJOR for changes that need action on the VM (new
  variables in `.env`, volume or network changes, a Kuma major upgrade); MINOR
  for new monitors, tiles or features; PATCH for fixes and documentation.
- Bump `VERSION` once per change that lands on `main` and add a matching entry
  to `CHANGELOG.md` in the same commit. `node --test "test/*.test.js"` checks they agree.
