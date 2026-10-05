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
