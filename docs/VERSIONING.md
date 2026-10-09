---
type: Reference
title: Versioning
description: Authoritative release version source and project-specific version
  change procedure.
---
# Versioning

- The root `VERSION` file is the single source of truth.
- Semantic versioning: MAJOR for changes that need action on the VM (new
  variables in `.env`, volume or network changes, a Kuma major upgrade); MINOR
  for new monitors, tiles or features; PATCH for fixes and documentation.
- Bump `VERSION` once per change that lands on `main` and add a matching entry
  to `CHANGELOG.md` in the same commit. `node --test "test/*.test.js"` checks they agree.
