---
type: Plan
title: lab-status Implementation Plan
description: Implementation sequence, dependencies and verification steps for
  the private lab monitoring and service landing stack.
---
# lab-status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Compose project that runs Uptime Kuma, Homepage and a read-only Docker socket proxy behind homelab-proxy, plus the two homelab-proxy sites that expose them.

**Architecture:** One Compose project (`name: lab-status`) with three services. socket-proxy is the only service that mounts the Docker socket and sits on an internal network shared with the two apps. Uptime Kuma and Homepage join the external `homelab-proxy` network under fixed aliases that Caddy dials. All behaviour is configuration (YAML) checked by static Node tests; the live deployment is a documented manual procedure on the VM.

**Tech Stack:** Docker Compose 2.24.4+, `louislam/uptime-kuma:2.5.5`, `ghcr.io/gethomepage/homepage:v2.4.0`, `lscr.io/linuxserver/socket-proxy:3.4.6-r0-ls100`, Caddy 2.10 (homelab-proxy), Node 20+ `node:test` (standard library only).

**Spec:** `docs/superpowers/specs/2026-10-05-lab-status-design.md`

## Global Constraints

- No service publishes a host port; Caddy is the only way in.
- `/var/run/docker.sock` is mounted only by `socket-proxy`, with `:ro`.
- socket-proxy environment is exactly `CONTAINERS=1`, `POST=0`; nothing else enabled.
- The `socket` network is `internal: true`; socket-proxy is not on `homelab-proxy`.
- Aliases on `homelab-proxy`: `uptime-kuma` (port 3001) and `homepage` (port 3000).
- Sites: `status.{$LAB_DOMAIN}` → `uptime-kuma:3001`, `home.{$LAB_DOMAIN}` → `homepage:3000`; each `import common`.
- Every image is pinned to a version tag, never `latest`.
- Every `${VAR}` in `compose.yaml` is documented in `.env.example`.
- Uptime Kuma trusts the homelab CA through `NODE_EXTRA_CA_CERTS=/certs/homelab-root.crt`; monitors never ignore TLS errors.
- Uptime Kuma maps every lab site name to `${PROXY_CADDY_IP}` with `extra_hosts`.
- Homepage: config mounted read-only, `LOG_TARGETS=stdout`, `HOMEPAGE_ALLOWED_HOSTS=home.${LAB_DOMAIN}`.
- Secrets (Discord webhook, Kuma admin) live only in the `kuma_data` volume; `.env` and `*.crt` are git-ignored.
- Versioning: root `VERSION` is the source of truth, semver, one CHANGELOG entry per change on `main`. lab-status starts at `0.1.0`; homelab-proxy goes `0.2.1` → `0.3.0`.
- Commit messages: plain lowercase summaries (house style), ending with the session's `Co-Authored-By` / `Claude-Session` trailer lines.
- Line endings LF (`.gitattributes`); tests strip `\r` anyway.

## Review Focus

1. **homelab-proxy's `LAB_ALLOWED_CIDRS` narrowed so it excludes `PROXY_SUBNET`** → Caddy aborts every Kuma check and all sites show down. Expect a test failure that names the cause (Task 4 cross-repo CIDR test) and a DEPLOY prerequisite.
2. **A new site added to homelab-proxy without a matching Kuma `extra_hosts` entry** → that check bypasses Caddy's fixed address and may fail through hairpin NAT. Expect a test that compares homelab-proxy's site names with Kuma's host list (Task 4).
3. **Someone widens the socket proxy** (adds `ALLOW_RESTARTS`, `EXEC`, `POST=1`) → Homepage or Kuma could control containers. Expect the exact-environment test to fail (Task 1).
4. **A Homepage skeleton file is missing from `config/`** → Homepage tries to write it into the read-only mount and fails at start. Expect a test that lists every file Homepage creates (Task 2).
5. **`HOMEPAGE_ALLOWED_HOSTS` or a site's upstream doesn't match the Caddy site** → Homepage answers "host validation failed", or Caddy returns 502. Expect tests that pin the env value (Task 1) and the site upstreams to the aliases (Task 4).

---

## Working location

All lab-status work happens in the existing worktree
`G:\GIT-REPOS\lab-status\.claude\worktrees\spec` (branch `spec`, which already
holds the spec and this plan). homelab-proxy work (Task 4) happens in a new
worktree created in that task. Run commands from the worktree root unless a
step says otherwise.

## File structure

lab-status:

| File | Responsibility |
|---|---|
| `compose.yaml` | the three services, their networks, volume and hardening |
| `.env.example` | every variable `compose.yaml` reads, with what it must match |
| `.gitignore`, `.gitattributes` | keep `.env` and certificates out of git; LF endings |
| `config/*.yaml`, `config/custom.*` | Homepage configuration, mounted read-only |
| `test/static.test.js` | all static checks, including cross-repo checks against homelab-proxy |
| `docs/DEPLOY.md` | VM procedure: prerequisites, first-run Kuma setup, monitors, alert test, backup |
| `docs/VERSIONING.md`, `VERSION`, `CHANGELOG.md` | release versioning |
| `AGENTS.md`, `README.md` | agent rules and overview |

homelab-proxy: `sites/status.caddy`, `sites/home.caddy` (new); `README.md`, `VERSION`, `CHANGELOG.md` (modified).

---

### Task 1: Compose project and its static tests

**Files:**
- Create: `test/static.test.js`
- Create: `compose.yaml`
- Create: `.env.example`
- Create: `.gitattributes`
- Modify: `.gitignore`

**Interfaces:**
- Produces (in `test/static.test.js`, used by Tasks 2–4): `ROOT`, `read(file)`, `code(file)` (comments and `\r` stripped), `block(text, key, indent)` (lines nested under `key:` at that indent), `service(name)`, `envFile(fullPath)`, `envExample()`, `KUMA_HOSTS` (function returning Kuma's `extra_hosts` site names).
- Produces (in `compose.yaml`): services `socket-proxy`, `uptime-kuma`, `homepage`; networks `socket`, `proxy` (= `homelab-proxy`); volume `kuma_data`; container names `lab-status-<service>-1`.

- [ ] **Step 1: Write the failing tests**

Create `test/static.test.js`:

```js
// Static checks for the lab-status Compose project and Homepage config. They
// read the YAML as text: it is kept plainly formatted (two-space indents, one
// key per line) so these slices stay reliable.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r/g, '');
// Drops comments (whole-line and trailing) so commented-out lines never count.
const code = (file) => read(file).replace(/(^|\s)#.*$/gm, '$1').replace(/[ \t]+$/gm, '');

// The lines nested under `key:` at `indent` spaces, up to the next line at that
// indent or less.
function block(text, key, indent) {
    const pad = ' '.repeat(indent);
    const lines = text.split('\n');
    const start = lines.findIndex((line) => line === `${pad}${key}:` || line.startsWith(`${pad}${key}: `));
    assert.notEqual(start, -1, `${key}: not found at indent ${indent}`);
    const body = [];
    for (const line of lines.slice(start + 1)) {
        if (line.trim() && line.search(/\S/) <= indent) break;
        body.push(line);
    }
    return body.join('\n');
}

const SERVICES = ['socket-proxy', 'uptime-kuma', 'homepage'];
const service = (name) => block(block(code('compose.yaml'), 'services', 0), name, 2);

function envFile(file) {
    return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
        .filter((line) => /^[A-Z_]+=/.test(line))
        .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
}
const envExample = () => envFile(path.join(ROOT, '.env.example'));

// Site names Uptime Kuma maps to Caddy's fixed address.
const KUMA_HOSTS = () => [...service('uptime-kuma')
    .matchAll(/- "([a-z0-9-]+)\.\$\{LAB_DOMAIN[^}]*\}:\$\{PROXY_CADDY_IP[^}]*\}"$/gm)].map((m) => m[1]);

test('no service publishes a host port', () => {
    for (const name of SERVICES) assert.doesNotMatch(service(name), /^\s+ports:/m, `${name} publishes ports`);
});

test('only socket-proxy mounts the Docker socket, read-only', () => {
    assert.match(service('socket-proxy'), /^\s+- \/var\/run\/docker\.sock:\/var\/run\/docker\.sock:ro$/m);
    for (const name of SERVICES.filter((n) => n !== 'socket-proxy')) {
        assert.doesNotMatch(service(name), /docker\.sock/, `${name} must not mount the Docker socket`);
    }
});

test('socket-proxy allows read-only container queries and nothing else', () => {
    const env = block(service('socket-proxy'), 'environment', 4);
    const vars = Object.fromEntries([...env.matchAll(/^\s+([A-Z_]+):\s*"?([^"\n]*)"?$/gm)].map((m) => [m[1], m[2]]));
    assert.deepEqual(vars, { CONTAINERS: '1', POST: '0' });
});

test('socket-proxy sits only on the internal socket network', () => {
    assert.match(service('socket-proxy'), /^ {4}networks: \[socket\]$/m);
    assert.match(block(code('compose.yaml'), 'networks', 0), /^ {2}socket:\n {4}internal: true$/m);
});

test('the apps join homelab-proxy under the aliases Caddy dials', () => {
    assert.match(block(code('compose.yaml'), 'networks', 0), /^ {2}proxy:\n {4}name: homelab-proxy\n {4}external: true$/m);
    assert.match(service('uptime-kuma'), /^ {6}proxy:\n {8}aliases: \[uptime-kuma\]$/m);
    assert.match(service('homepage'), /^ {6}proxy:\n {8}aliases: \[homepage\]$/m);
});

test('every image is pinned to a version tag', () => {
    const images = [...code('compose.yaml').matchAll(/^\s+image:\s*(\S+)$/gm)].map((m) => m[1]);
    assert.equal(images.length, SERVICES.length);
    for (const image of images) assert.match(image, /:v?\d[\w.-]*$/, `${image} is not pinned to a version`);
});

test('.env.example documents every variable compose.yaml uses', () => {
    const documented = Object.keys(envExample());
    const used = new Set([...code('compose.yaml').matchAll(/\$\{([A-Z_]+)/g)].map((m) => m[1]));
    assert.ok(used.size > 0);
    for (const name of used) assert.ok(documented.includes(name), `${name} missing from .env.example`);
});

test('Uptime Kuma keeps its data in a volume and verifies HTTPS against the homelab CA', () => {
    const kuma = service('uptime-kuma');
    assert.match(kuma, /^\s+- kuma_data:\/app\/data$/m);
    assert.match(kuma, /^\s+NODE_EXTRA_CA_CERTS: \/certs\/homelab-root\.crt$/m);
    assert.match(kuma, /^\s+- \$\{HOMELAB_CA_ROOT[^}]*\}:\/certs\/homelab-root\.crt:ro$/m);
});

test('Uptime Kuma resolves every lab site to Caddy', () => {
    assert.deepEqual(KUMA_HOSTS().sort(),
        ['dashboard', 'foundry', 'home', 'nettools', 'npc-import', 'sillytavern', 'st-uplink', 'status']);
});

test('Homepage accepts only its proxied host name and reads config read-only', () => {
    const home = service('homepage');
    const env = block(home, 'environment', 4);
    assert.match(env, /^\s+HOMEPAGE_ALLOWED_HOSTS: home\.\$\{LAB_DOMAIN[^}]*\}$/m);
    assert.match(env, /^\s+HOMEPAGE_VAR_LAB_DOMAIN: \$\{LAB_DOMAIN[^}]*\}$/m);
    assert.match(env, /^\s+LOG_TARGETS: stdout$/m);
    assert.match(home, /^\s+- \.\/config:\/app\/config:ro$/m);
});

test('every service is hardened and has a memory limit', () => {
    for (const name of SERVICES) {
        const svc = service(name);
        assert.match(svc, /no-new-privileges:true/, `${name} lacks no-new-privileges`);
        assert.match(svc, /^\s+limits: \{memory: \d+M\}$/m, `${name} lacks a memory limit`);
        assert.match(svc, /^ {4}restart: unless-stopped$/m, `${name} lacks a restart policy`);
    }
});

test('secrets and certificates are ignored by Git', () => {
    const ignored = read('.gitignore');
    for (const pattern of ['.env', '*.crt']) assert.match(ignored, new RegExp(`^${pattern.replace(/[.*]/g, '\\$&')}$`, 'm'));
});

module.exports = { ROOT, read, code, block, service, envFile, envExample, KUMA_HOSTS };
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/`
Expected: FAIL, most tests with `ENOENT: no such file or directory, open '...compose.yaml'`.

- [ ] **Step 3: Write `compose.yaml`, `.env.example`, `.gitattributes` and `.gitignore`**

`compose.yaml`:

```yaml
name: lab-status

# Start after homelab-proxy: its stack creates the external homelab-proxy
# network these apps join. See docs/DEPLOY.md.
x-logging: &logging
  driver: json-file
  options: {max-size: "10m", max-file: "3"}

services:
  socket-proxy:
    image: lscr.io/linuxserver/socket-proxy:3.4.6-r0-ls100
    restart: unless-stopped
    environment:
      # Read-only container queries. Every other Docker API family stays off.
      CONTAINERS: "1"
      POST: "0"
    volumes:
      # The only service that touches the socket.
      - /var/run/docker.sock:/var/run/docker.sock:ro
    read_only: true
    tmpfs: [/run]
    security_opt: ["no-new-privileges:true"]
    networks: [socket]
    logging: *logging
    deploy:
      resources:
        limits: {memory: 64M}

  uptime-kuma:
    image: louislam/uptime-kuma:2.5.5
    restart: unless-stopped
    environment:
      # Caddy's internal CA, so HTTPS monitors verify certificates.
      NODE_EXTRA_CA_CERTS: /certs/homelab-root.crt
    volumes:
      # Database, monitors, admin account and Discord webhook: back it up.
      - kuma_data:/app/data
      - ${HOMELAB_CA_ROOT:?set HOMELAB_CA_ROOT in .env}:/certs/homelab-root.crt:ro
    extra_hosts:
      # Checks go straight to Caddy over homelab-proxy, not through the VM's
      # DNS or hairpin NAT. Keep in step with homelab-proxy's sites/.
      - "dashboard.${LAB_DOMAIN:?set LAB_DOMAIN in .env}:${PROXY_CADDY_IP:?set PROXY_CADDY_IP in .env}"
      - "foundry.${LAB_DOMAIN}:${PROXY_CADDY_IP}"
      - "home.${LAB_DOMAIN}:${PROXY_CADDY_IP}"
      - "nettools.${LAB_DOMAIN}:${PROXY_CADDY_IP}"
      - "npc-import.${LAB_DOMAIN}:${PROXY_CADDY_IP}"
      - "sillytavern.${LAB_DOMAIN}:${PROXY_CADDY_IP}"
      - "st-uplink.${LAB_DOMAIN}:${PROXY_CADDY_IP}"
      - "status.${LAB_DOMAIN}:${PROXY_CADDY_IP}"
    security_opt: ["no-new-privileges:true"]
    networks:
      default: {}
      socket: {}
      proxy:
        aliases: [uptime-kuma]
    logging: *logging
    deploy:
      resources:
        limits: {memory: 512M}

  homepage:
    image: ghcr.io/gethomepage/homepage:v2.4.0
    restart: unless-stopped
    environment:
      HOMEPAGE_ALLOWED_HOSTS: home.${LAB_DOMAIN:?set LAB_DOMAIN in .env}
      # Used as {{HOMEPAGE_VAR_LAB_DOMAIN}} in config/services.yaml.
      HOMEPAGE_VAR_LAB_DOMAIN: ${LAB_DOMAIN}
      # The config mount is read-only, so logs go to stdout only.
      LOG_TARGETS: stdout
    volumes:
      - ./config:/app/config:ro
    security_opt: ["no-new-privileges:true"]
    networks:
      default: {}
      socket: {}
      proxy:
        aliases: [homepage]
    logging: *logging
    deploy:
      resources:
        limits: {memory: 256M}

networks:
  # Docker API traffic only: unreachable from Caddy and from outside.
  socket:
    internal: true
  proxy:
    name: homelab-proxy
    external: true

volumes:
  kuma_data:
```

`.env.example`:

```sh
# Copy to .env next to compose.yaml and edit.

# Parent domain of the lab sites: the same value as homelab-proxy's LAB_DOMAIN.
LAB_DOMAIN=lab.spiralfrenzy.com

# Caddy's fixed address on the homelab-proxy network: homelab-proxy's
# PROXY_CADDY_IP. Uptime Kuma sends its HTTPS checks there, so homelab-proxy's
# LAB_ALLOWED_CIDRS must include its PROXY_SUBNET or every check is refused.
PROXY_CADDY_IP=172.31.250.2

# Host path of homelab-proxy's root certificate. Its docs/TRUST.md Linux step
# installs it here; any readable copy works.
HOMELAB_CA_ROOT=/usr/local/share/ca-certificates/homelab-proxy-root.crt
```

`.gitattributes`:

```
* text=auto eol=lf
```

`.gitignore` (replace the whole file):

```
.claude/worktrees/
.env
*.crt
*.key
*.pem
*.tgz
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/`
Expected: PASS, 12 tests, 0 failures.

- [ ] **Step 5: Check the tests catch a widened socket proxy (Review Focus 3)**

Temporarily add `      ALLOW_RESTARTS: "1"` under socket-proxy's `environment:` and run `node --test test/`.
Expected: FAIL in `socket-proxy allows read-only container queries and nothing else`. Remove the line and rerun: PASS.

- [ ] **Step 6: Validate with Docker if it is installed**

Run: `docker compose --env-file .env.example config --quiet` (only if `docker` is on PATH; it is not on the development PC, so record "skipped: no Docker" otherwise).
Expected: no output, exit 0.

- [ ] **Step 7: Commit**

```bash
git add compose.yaml .env.example .gitattributes .gitignore test/static.test.js
git commit -m "add the Uptime Kuma, Homepage and socket proxy compose project"
```

---

### Task 2: Homepage configuration

**Files:**
- Create: `config/settings.yaml`, `config/services.yaml`, `config/widgets.yaml`, `config/docker.yaml`, `config/bookmarks.yaml`, `config/kubernetes.yaml`, `config/proxmox.yaml`, `config/custom.css`, `config/custom.js`
- Modify: `test/static.test.js` (append tests before the `module.exports` line)

**Interfaces:**
- Consumes: `read`, `code`, `ROOT` from Task 1's test file; Compose service names `uptime-kuma` (port 3001) and `socket-proxy` (port 2375); env `HOMEPAGE_VAR_LAB_DOMAIN`.
- Produces: Docker server name `lab`; Uptime Kuma status page slug `lab` (created by hand in Task 3's DEPLOY procedure); Homepage groups `Lab apps` and `Infrastructure`.

- [ ] **Step 1: Write the failing tests**

Append to `test/static.test.js`, above `module.exports`:

```js
// Homepage copies any of these it cannot find into /app/config, which is
// mounted read-only, so all of them must exist.
const HOMEPAGE_FILES = ['bookmarks.yaml', 'custom.css', 'custom.js', 'docker.yaml', 'kubernetes.yaml',
    'proxmox.yaml', 'services.yaml', 'settings.yaml', 'widgets.yaml'];

test('config holds every file Homepage would otherwise create', () => {
    for (const file of HOMEPAGE_FILES) assert.ok(fs.existsSync(path.join(ROOT, 'config', file)), `config/${file} missing`);
});

test('Homepage reads Docker through the socket proxy', () => {
    assert.match(code('config/docker.yaml'), /^lab:\n {2}host: socket-proxy\n {2}port: 2375$/m);
});

test('container tiles use the lab Docker server and links use the lab domain', () => {
    const services = code('config/services.yaml');
    const containers = [...services.matchAll(/^\s+container: \S+$/gm)];
    const servers = [...services.matchAll(/^\s+server: (\S+)$/gm)].map((m) => m[1]);
    assert.ok(containers.length > 0);
    assert.equal(servers.length, containers.length, 'every container: needs a server: and vice versa');
    assert.ok(servers.every((s) => s === 'lab'), 'server must be lab');
    const links = [...services.matchAll(/^\s+href: (\S+)$/gm)].map((m) => m[1]);
    assert.ok(links.length > 0);
    for (const link of links) assert.match(link, /^https:\/\/[a-z0-9-]+\.\{\{HOMEPAGE_VAR_LAB_DOMAIN\}\}\/?$/, link);
    assert.doesNotMatch(services, /spiralfrenzy/i, 'hard-coded domain');
});

test('the Uptime Kuma widget reads the lab status page over the internal network', () => {
    assert.match(code('config/services.yaml'),
        /^\s+type: uptimekuma\n\s+url: http:\/\/uptime-kuma:3001\n\s+slug: lab$/m);
});

test('the layout names exactly the groups services.yaml defines', () => {
    const groups = [...code('config/services.yaml').matchAll(/^- (.+):$/gm)].map((m) => m[1]).sort();
    const layout = [...block(code('config/settings.yaml'), 'layout', 0).matchAll(/^ {2}(\S.*):$/gm)].map((m) => m[1]).sort();
    assert.deepEqual(layout, groups);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/`
Expected: the 5 new tests FAIL (`config/bookmarks.yaml missing`, `ENOENT ... config/docker.yaml`); Task 1's 12 still PASS.

- [ ] **Step 3: Write the Homepage files**

`config/settings.yaml`:

```yaml
# Homepage settings: https://gethomepage.dev/configs/settings/
title: Lab
theme: dark
color: slate
headerStyle: clean
hideVersion: true
layout:
  Lab apps:
    style: row
    columns: 3
  Infrastructure:
    style: row
    columns: 3
```

`config/docker.yaml`:

```yaml
# Read-only Docker API through the socket proxy (compose.yaml).
lab:
  host: socket-proxy
  port: 2375
```

`config/services.yaml`:

```yaml
# One tile per lab app. `server: lab` with `container:` adds live status, CPU
# and memory. Names are Compose's <project>-<service>-1; confirm them with
# `docker ps` on the VM (docs/DEPLOY.md). Foundry, SillyTavern and NPC import
# get their container: lines at deploy time: their compose files exist only on
# the VM.
- Lab apps:
    - Network tools:
        href: https://nettools.{{HOMEPAGE_VAR_LAB_DOMAIN}}
        description: network-tools-portal
        icon: mdi-lan
        server: lab
        container: nettools-web-1
    - Agent dashboard:
        href: https://dashboard.{{HOMEPAGE_VAR_LAB_DOMAIN}}
        description: ai-agent-dashboard
        icon: mdi-view-dashboard
        server: lab
        container: docker-dashboard-1
    - Foundry VTT:
        href: https://foundry.{{HOMEPAGE_VAR_LAB_DOMAIN}}
        description: Foundry v13
        icon: mdi-dice-d20
    - SillyTavern:
        href: https://sillytavern.{{HOMEPAGE_VAR_LAB_DOMAIN}}
        description: SillyTavern and its Foundry uplink
        icon: mdi-chat
    - NPC import:
        href: https://npc-import.{{HOMEPAGE_VAR_LAB_DOMAIN}}
        description: lancer-npc-import-gui
        icon: mdi-account-arrow-down

- Infrastructure:
    - Uptime Kuma:
        href: https://status.{{HOMEPAGE_VAR_LAB_DOMAIN}}
        description: Monitors and alerts
        icon: mdi-heart-pulse
        server: lab
        container: lab-status-uptime-kuma-1
        widget:
          type: uptimekuma
          url: http://uptime-kuma:3001
          slug: lab
    - Caddy:
        description: homelab-proxy
        icon: mdi-shield-lock
        server: lab
        container: homelab-proxy-caddy-1
    - Socket proxy:
        description: Read-only Docker API
        icon: mdi-docker
        server: lab
        container: lab-status-socket-proxy-1
```

`config/widgets.yaml`:

```yaml
# VM-wide figures: inside a container /proc reports the host's CPU and memory.
- resources:
    label: sfdockerhost1
    cpu: true
    memory: true
    disk: /
- datetime:
    format:
      dateStyle: medium
      timeStyle: short
```

`config/bookmarks.yaml`, `config/kubernetes.yaml`, `config/proxmox.yaml` — each exactly:

```yaml
# Unused. Present so Homepage does not try to create it in the read-only mount.
```

`config/custom.css` — exactly:

```css
/* Unused. Present so Homepage does not try to create it in the read-only mount. */
```

`config/custom.js` — exactly:

```js
// Unused. Present so Homepage does not try to create it in the read-only mount.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/`
Expected: PASS, 17 tests, 0 failures.

- [ ] **Step 5: Check the skeleton test (Review Focus 4)**

Temporarily rename `config/proxmox.yaml` to `config/proxmox.yaml.bak`; run `node --test test/`.
Expected: FAIL `config/proxmox.yaml missing`. Rename it back; rerun: PASS.

- [ ] **Step 6: Commit**

```bash
git add config test/static.test.js
git commit -m "add the Homepage links hub configuration"
```

---

### Task 3: Deploy guide, versioning and repository docs

**Files:**
- Create: `docs/DEPLOY.md`, `docs/VERSIONING.md`, `VERSION`, `CHANGELOG.md`, `AGENTS.md`
- Modify: `README.md` (replace whole file)
- Modify: `test/static.test.js` (append above `module.exports`)

**Interfaces:**
- Consumes: service, volume and container names from Tasks 1–2 (`lab-status_kuma_data`, `lab-status-uptime-kuma-1`, `socket-proxy:2375`, slug `lab`).
- Produces: `VERSION` = `0.1.0`; the DEPLOY procedure Task 5 hands to the user.

- [ ] **Step 1: Write the failing tests**

Append above `module.exports`:

```js
test('VERSION matches the newest CHANGELOG entry', () => {
    const version = read('VERSION').trim();
    assert.match(version, /^\d+\.\d+\.\d+$/);
    const newest = read('CHANGELOG.md').match(/^## (\S+) — \d{4}-\d{2}-\d{2}$/m);
    assert.ok(newest, 'CHANGELOG.md has no "## x.y.z — YYYY-MM-DD" entry');
    assert.equal(newest[1], version);
});

test('the deploy guide covers the steps a first deployment needs', () => {
    const guide = read('docs/DEPLOY.md');
    for (const needle of ['LAB_ALLOWED_CIDRS', "docker ps --format '{{.Names}}'", 'tcp://socket-proxy:2375',
        'Trust Proxy', 'Discord', 'slug `lab`', 'lab-status_kuma_data', 'docker stop']) {
        assert.ok(guide.includes(needle), `docs/DEPLOY.md does not mention ${needle}`);
    }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/`
Expected: the 2 new tests FAIL with `ENOENT ... VERSION` and `ENOENT ... docs/DEPLOY.md`.

- [ ] **Step 3: Write the docs**

`VERSION` (with trailing newline):

```
0.1.0
```

`CHANGELOG.md`:

```md
# Changelog

## 0.1.0 — 2026-10-05

- Uptime Kuma 2.5.5 at `status.<LAB_DOMAIN>`: HTTPS checks through Caddy with
  the homelab CA, container checks through the socket proxy, Discord alerts.
- Homepage v2.4.0 at `home.<LAB_DOMAIN>`: links to every lab app with live
  container status, CPU and memory, VM-wide resources, and an Uptime Kuma summary.
- Read-only Docker socket proxy on an internal network; no published ports.
- VM deployment, first-run setup, alert test and backup guide.
```

`docs/VERSIONING.md`:

```md
# Versioning

- The root `VERSION` file is the single source of truth.
- Semantic versioning: MAJOR for changes that need action on the VM (new
  variables in `.env`, volume or network changes, a Kuma major upgrade); MINOR
  for new monitors, tiles or features; PATCH for fixes and documentation.
- Bump `VERSION` once per change that lands on `main` and add a matching entry
  to `CHANGELOG.md` in the same commit. `node --test test/` checks they agree.
```

`AGENTS.md`:

```md
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
```

`README.md` (replace):

````md
# lab-status

A private ops view of the lab Docker VM, behind
[homelab-proxy](../homelab-proxy):

| Site | App | What it shows |
|---|---|---|
| `status.<LAB_DOMAIN>` | Uptime Kuma | up/down and uptime history of every site and container; Discord alerts |
| `home.<LAB_DOMAIN>` | Homepage | links to every lab app, live container status, CPU and memory, VM resources |

```
caddy ─┬─▶ uptime-kuma:3001 ─┐
       └─▶ homepage:3000 ────┴─▶ socket-proxy:2375 (internal, read-only) ─▶ docker.sock
```

Only the socket proxy touches the Docker socket, and it allows nothing but
read-only container queries. No container publishes a port. Uptime Kuma keeps
its own login; Homepage is reachable only through homelab-proxy's LAN/VPN
allow-list.

## Deploy

On the VM, after homelab-proxy 0.3.0 or later:

```sh
cp .env.example .env
docker compose up -d
```

Then follow [docs/DEPLOY.md](docs/DEPLOY.md) for container names, Uptime Kuma's
first run, monitors, the alert test and backups.

## Test

```sh
node --test test/
```

Node 20+ only. The version is in `VERSION` ([docs/VERSIONING.md](docs/VERSIONING.md)).
````

`docs/DEPLOY.md`:

````md
# Deploy on the lab VM

Run these on the VM that hosts homelab-proxy (Docker Engine, Compose 2.24.4 or
later), in this repository's checkout.

## 1. Prerequisites

- homelab-proxy 0.3.0 or later is running. It creates the `homelab-proxy`
  network and serves the `status` and `home` sites.
- homelab-proxy's `LAB_ALLOWED_CIDRS` includes its `PROXY_SUBNET`. The shipped
  default `172.16.0.0/12` covers `172.31.250.0/24`. If you narrow the list, add
  the proxy subnet back, or Caddy refuses every Uptime Kuma check and all sites
  show down.
- homelab-proxy's root certificate is on the VM. Its `docs/TRUST.md` Linux step
  installs it at `/usr/local/share/ca-certificates/homelab-proxy-root.crt`,
  which is the default `HOMELAB_CA_ROOT`.

## 2. Confirm container names

```sh
docker ps --format '{{.Names}}' | sort
```

Compare the list with `config/services.yaml`:

- Fix any `container:` name that differs.
- Foundry, SillyTavern and NPC import ship without `container:` because their
  compose files live only on the VM. Add `server: lab` and `container: <name>`
  under each.

Commit those edits so the repository matches the VM.

## 3. Start

```sh
cp .env.example .env          # check LAB_DOMAIN, PROXY_CADDY_IP, HOMELAB_CA_ROOT
docker compose up -d
docker compose ps             # three services running; uptime-kuma and homepage healthy
docker compose logs homepage | tail -n 20
```

Homepage must not log a read-only or permission error. If it names a file,
create that file empty in `config/` and add it to the test's `HOMEPAGE_FILES`.

## 4. Uptime Kuma first run

Open `https://status.<LAB_DOMAIN>`:

1. Choose **SQLite** and create the admin account. Keep the password in your
   password manager.
2. **Settings → Reverse Proxy → Trust Proxy: Yes.**
3. **Settings → Docker Hosts → Setup Docker Host:** name `lab`, connection type
   **TCP / HTTP**, daemon `tcp://socket-proxy:2375`. Use **Test**.
4. **Settings → Notifications → Setup Notification:** type **Discord**, paste
   the webhook URL (in Discord: Server Settings → Integrations → Webhooks → New
   Webhook → Copy Webhook URL). Tick **Default enabled** and **Apply on all
   existing monitors**, then **Test**.
5. Add the monitors below. HTTP(s) monitors: interval 60 s, accepted status
   codes `200-399`; if a site answers `401` because of its own login, add `401`.
   Never tick "Ignore TLS/SSL errors".

   | Name | Type | Target |
   |---|---|---|
   | nettools | HTTP(s) | `https://nettools.<LAB_DOMAIN>/` |
   | dashboard | HTTP(s) | `https://dashboard.<LAB_DOMAIN>/` |
   | foundry | HTTP(s) | `https://foundry.<LAB_DOMAIN>/` |
   | sillytavern | HTTP(s) | `https://sillytavern.<LAB_DOMAIN>/` |
   | npc-import | HTTP(s) | `https://npc-import.<LAB_DOMAIN>/` |
   | home | HTTP(s) | `https://home.<LAB_DOMAIN>/` |
   | each container from step 2 except `lab-status-uptime-kuma-1` | Docker Container | its name, Docker host `lab` |

   `st-uplink` is a plugin listener without a page of its own; the SillyTavern
   container monitor covers it.
6. **Status Pages → New Status Page:** name `Lab`, slug `lab`. Add the HTTP(s)
   monitors and save. Homepage's Uptime Kuma tile reads this page.

## 5. Check

- `https://home.<LAB_DOMAIN>` shows every tile. Container tiles show running
  with CPU and memory, and the Uptime Kuma tile shows up/down counts.
- Alert test: `docker stop nettools-web-1`. Within about two minutes Discord
  shows the monitor down. `docker start nettools-web-1` and Discord shows it up.

## Back up and restore

The `lab-status_kuma_data` volume holds everything Uptime Kuma knows, including
the admin password hash and the Discord webhook URL. Keep backups private.

```sh
docker compose stop uptime-kuma
docker run --rm -v lab-status_kuma_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/kuma-data-$(date +%F).tgz -C /data .
docker compose start uptime-kuma
```

Restore (replace `DATE`):

```sh
docker compose stop uptime-kuma
docker run --rm -v lab-status_kuma_data:/data -v "$PWD":/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/kuma-data-DATE.tgz -C /data'
docker compose start uptime-kuma
```

Homepage has no state: its configuration is this repository.

## Upgrade

Back up `kuma_data`, change the image tag in `compose.yaml`, bump `VERSION` and
`CHANGELOG.md`, then:

```sh
docker compose pull
docker compose up -d
```
````

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/`
Expected: PASS, 19 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add VERSION CHANGELOG.md AGENTS.md README.md docs/DEPLOY.md docs/VERSIONING.md test/static.test.js
git commit -m "add the deploy guide, versioning and agent instructions"
```

---

### Task 4: homelab-proxy sites and cross-repo checks

**Files:**
- Create (homelab-proxy): `sites/status.caddy`, `sites/home.caddy`
- Modify (homelab-proxy): `README.md` (site table and diagram), `VERSION`, `CHANGELOG.md`
- Modify (lab-status): `test/static.test.js` (append above `module.exports`)

**Interfaces:**
- Consumes: aliases `uptime-kuma:3001`, `homepage:3000`; `KUMA_HOSTS()`, `envFile`, `envExample` from the lab-status test file.
- Produces: homelab-proxy `0.3.0` with sites `status` and `home`.

- [ ] **Step 1: Create the homelab-proxy worktree**

Run (PowerShell):

```powershell
git -C G:\GIT-REPOS\homelab-proxy status --short
git -C G:\GIT-REPOS\homelab-proxy worktree add -b lab-status-sites .claude/worktrees/lab-status-sites main
```

Expected: the worktree is created at `G:\GIT-REPOS\homelab-proxy\.claude\worktrees\lab-status-sites`. Claude Code's background-job guard can refuse `git -C` against another repository's main checkout while the session is inside a worktree; if it does, use ExitWorktree (`keep`), run the two commands, and re-enter the lab-status worktree with EnterWorktree `path`. Edits and commits inside the homelab-proxy worktree work from either session location. If `status --short` shows uncommitted changes to `README.md`, `VERSION` or `CHANGELOG.md`, stop and report them; another session is editing those files.

- [ ] **Step 2: Write the failing cross-repo tests in lab-status**

Append above `module.exports` in lab-status `test/static.test.js`:

```js
// homelab-proxy from HOMELAB_PROXY_DIR, else the nearest sibling checkout.
function homelabProxyDir() {
    if (process.env.HOMELAB_PROXY_DIR) return path.resolve(process.env.HOMELAB_PROXY_DIR);
    for (let dir = path.dirname(ROOT); dir !== path.dirname(dir); dir = path.dirname(dir)) {
        const candidate = path.join(dir, 'homelab-proxy');
        if (fs.existsSync(path.join(candidate, 'Caddyfile'))) return candidate;
    }
    return null;
}
const PROXY = homelabProxyDir();
const skipProxy = PROXY ? false : 'homelab-proxy checkout not found';
const proxyRead = (file) => fs.readFileSync(path.join(PROXY, file), 'utf8').replace(/\r/g, '');
const proxySites = () => fs.readdirSync(path.join(PROXY, 'sites')).filter((f) => f.endsWith('.caddy'))
    .flatMap((f) => [...proxyRead(`sites/${f}`).matchAll(/^([a-z0-9-]+)\.\{\$LAB_DOMAIN\}\s*\{$/gm)].map((m) => m[1]));

test('homelab-proxy routes status and home to these services', { skip: skipProxy }, () => {
    assert.match(proxyRead('sites/status.caddy'), /^status\.\{\$LAB_DOMAIN\} \{\n\timport common\n\treverse_proxy uptime-kuma:3001\n\}$/m);
    assert.match(proxyRead('sites/home.caddy'), /^home\.\{\$LAB_DOMAIN\} \{\n\timport common\n\treverse_proxy homepage:3000\n\}$/m);
});

test('Uptime Kuma resolves exactly the sites homelab-proxy serves', { skip: skipProxy }, () => {
    assert.deepEqual(KUMA_HOSTS().sort(), proxySites().sort());
});

test('Caddy accepts Uptime Kuma checks from the proxy network', { skip: skipProxy }, () => {
    const proxyEnv = envFile(path.join(PROXY, '.env.example'));
    assert.equal(envExample().PROXY_CADDY_IP, proxyEnv.PROXY_CADDY_IP, 'PROXY_CADDY_IP differs from homelab-proxy');
    const toInt = (ip) => ip.split('.').reduce((n, part) => n * 256 + Number(part), 0) >>> 0;
    const parse = (cidr) => { const [base, bits] = cidr.split('/'); return { base: toInt(base), bits: Number(bits) }; };
    const within = (inner, outer) => {
        const mask = outer.bits === 0 ? 0 : (2 ** 32 - 2 ** (32 - outer.bits)) >>> 0;
        return outer.bits <= inner.bits && ((inner.base & mask) >>> 0) === ((outer.base & mask) >>> 0);
    };
    const subnet = parse(proxyEnv.PROXY_SUBNET);
    const allowed = proxyEnv.LAB_ALLOWED_CIDRS.split(/\s+/).filter(Boolean).map(parse);
    assert.ok(allowed.some((cidr) => within(subnet, cidr)),
        `LAB_ALLOWED_CIDRS must include PROXY_SUBNET ${proxyEnv.PROXY_SUBNET}, or Caddy refuses Uptime Kuma's checks`);
});
```

- [ ] **Step 3: Run the tests against the worktree to verify they fail**

Run (PowerShell, from the lab-status worktree):

```powershell
$env:HOMELAB_PROXY_DIR = 'G:\GIT-REPOS\homelab-proxy\.claude\worktrees\lab-status-sites'; node --test test/
```

Expected: `homelab-proxy routes status and home` FAILS with `ENOENT ... sites/status.caddy`; `Uptime Kuma resolves exactly the sites` FAILS (Kuma has `home`, `status` that homelab-proxy lacks); the CIDR test PASSES.

- [ ] **Step 4: Check the CIDR test catches a narrowed allow-list (Review Focus 1)**

In the homelab-proxy worktree, temporarily set `.env.example`'s line to `LAB_ALLOWED_CIDRS=192.168.0.0/16` and rerun the Step 3 command.
Expected: FAIL `LAB_ALLOWED_CIDRS must include PROXY_SUBNET 172.31.250.0/24`. Restore the line with `git -C G:\GIT-REPOS\homelab-proxy\.claude\worktrees\lab-status-sites checkout -- .env.example` and confirm `git -C G:\GIT-REPOS\homelab-proxy\.claude\worktrees\lab-status-sites status --short` is clean.

- [ ] **Step 5: Add the sites in the homelab-proxy worktree**

`sites/status.caddy`:

```caddyfile
# lab-status's Uptime Kuma: joins the homelab-proxy network as `uptime-kuma`.
# Its WebSocket UI works through the default reverse_proxy. Kuma keeps its own
# login and trusts forwarded headers once "Trust Proxy" is enabled.
status.{$LAB_DOMAIN} {
	import common
	reverse_proxy uptime-kuma:3001
}
```

`sites/home.caddy`:

```caddyfile
# lab-status's Homepage: joins the homelab-proxy network as `homepage`. It has
# no login of its own; the LAN/VPN allow-list in `common` is its boundary.
home.{$LAB_DOMAIN} {
	import common
	reverse_proxy homepage:3000
}
```

Use tab indentation inside the blocks (the repository keeps `caddy fmt` style).

- [ ] **Step 6: Update homelab-proxy's README, VERSION and CHANGELOG**

In `README.md`, add two lines to the diagram after `└─▶ lancer-import-gui:5089` by changing that line's `└─▶` to `├─▶` and appending:

```
                                                         ├─▶ uptime-kuma:3001
                                                         └─▶ homepage:3000
```

and add two rows at the end of the site table:

```md
| `status.<LAB_DOMAIN>` | lab-status: Uptime Kuma | `compose.yaml` in lab-status (joins the network directly) |
| `home.<LAB_DOMAIN>` | lab-status: Homepage | same lab-status project |
```

`VERSION`: `0.3.0`

`CHANGELOG.md`: insert below `# Changelog`:

```md
## 0.3.0 — 2026-10-05

- Sites for lab-status: Uptime Kuma (`status`) and Homepage (`home`).
```

- [ ] **Step 7: Run both suites**

Run (PowerShell):

```powershell
node --test G:\GIT-REPOS\homelab-proxy\.claude\worktrees\lab-status-sites\test\
$env:HOMELAB_PROXY_DIR = 'G:\GIT-REPOS\homelab-proxy\.claude\worktrees\lab-status-sites'; node --test test/
```

Expected: homelab-proxy's static tests PASS (its live Caddy tests skip without `CADDY_BIN`); lab-status PASS, 22 tests, 0 failures.

- [ ] **Step 8: Commit in each repository**

```powershell
git -C G:\GIT-REPOS\homelab-proxy\.claude\worktrees\lab-status-sites add sites/status.caddy sites/home.caddy README.md VERSION CHANGELOG.md
git -C G:\GIT-REPOS\homelab-proxy\.claude\worktrees\lab-status-sites commit -m "add sites for lab-status's Uptime Kuma and Homepage"
git add test/static.test.js
git commit -m "check the homelab-proxy sites, hosts and allow-list against this project"
```

---

### Task 5: Verify, record and hand off

**Files:**
- Modify: `docs/superpowers/specs/2026-10-05-lab-status-design.md` (status line only)

- [ ] **Step 1: Run every check fresh**

```powershell
$env:HOMELAB_PROXY_DIR = 'G:\GIT-REPOS\homelab-proxy\.claude\worktrees\lab-status-sites'; node --test test/
node --test G:\GIT-REPOS\homelab-proxy\.claude\worktrees\lab-status-sites\test\
```

Expected: both PASS. Record the pass/fail/skip counts for the dashboard.

- [ ] **Step 2: Inspect both diffs**

```powershell
git diff main --stat
git -C G:\GIT-REPOS\homelab-proxy\.claude\worktrees\lab-status-sites diff main --stat
```

Expected: lab-status touches only the files in this plan's file table plus the spec and plan; homelab-proxy touches exactly `sites/status.caddy`, `sites/home.caddy`, `README.md`, `VERSION`, `CHANGELOG.md`. Search the lab-status diff for `discord.com/api/webhooks` and for a real domain inside `config/`: both must be absent.

- [ ] **Step 3: Mark the spec implemented**

Change the spec's second line to:

```md
Date: 2026-10-05. Status: implemented in lab-status 0.1.0 and homelab-proxy 0.3.0; deployment on the VM pending (docs/DEPLOY.md).
```

Commit: `git add docs/superpowers/specs && git commit -m "mark the design spec implemented"`.

- [ ] **Step 4: Record in the dashboard**

For each project (`lab-status`, `homelab-proxy`) post through `dashboard-cli.js` (run with `node --use-system-ca`, `DASHBOARD_CLIENT_CONFIG=G:\GIT-REPOS\.agent-dashboard.json`): a `test-result` with the Step 1 counts, and an agent handoff note (agent `claude`, model `claude-opus-5-5`) that lists the branch, the commits and "deployment on the VM is the next manual step: lab-status docs/DEPLOY.md". Post a `document-review` for the spec, plan and `docs/DEPLOY.md` with `freshness: current`. Command names and flags: `node --use-system-ca G:\GIT-REPOS\ai-agent-dashboard\dashboard-cli.js --help`.

- [ ] **Step 5: Hand off**

Report to the user: the two branches and worktrees, the test counts, that merging is done with `/land` in each repository (homelab-proxy first, so its sites are on `main` before lab-status), and that deployment follows `docs/DEPLOY.md` on the VM. Mention what remains unverified: the live containers, Homepage's read-only config at start-up, the Docker host connection in Kuma, and the Discord alert.
