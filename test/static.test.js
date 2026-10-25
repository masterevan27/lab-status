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

// Until upstream ships the status page uptime-range selector, Uptime Kuma is
// built from the fork checkout with the Dockerfile kept here.
test('Uptime Kuma is built from the fork checkout with the local Dockerfile', () => {
    const kuma = service('uptime-kuma');
    assert.match(kuma, /^ {4}image: lab-status\/uptime-kuma:\d[\w.-]*-range\.\d+$/m);
    assert.match(kuma, /^ {4}build:\n {6}context: kuma\n {6}additional_contexts:\n {8}src: \$\{KUMA_SRC:-\.\.\/uptime-kuma\}$/m);
    assert.ok(fs.existsSync(path.join(ROOT, 'kuma', 'Dockerfile')), 'kuma/Dockerfile is missing');
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
});

// The short `src:dst` form makes Docker create a missing source as a root-owned
// directory: Node then ignores the CA and every HTTPS monitor fails quietly.
test('Uptime Kuma refuses to start when the CA file is missing', () => {
    assert.match(service('uptime-kuma'), new RegExp([
        String.raw`^ {6}- type: bind`,
        String.raw` {8}source: \$\{HOMELAB_CA_ROOT:\?[^}]*\}`,
        String.raw` {8}target: /certs/homelab-root\.crt`,
        String.raw` {8}read_only: true`,
        String.raw` {8}bind:`,
        String.raw` {10}create_host_path: false$`,
    ].join('\n'), 'm'));
});

test('Uptime Kuma resolves every lab site to Caddy', () => {
    assert.deepEqual(KUMA_HOSTS().sort(),
        ['dashboard', 'files', 'foundry', 'home', 'librenms', 'netmap', 'nettools', 'npc-import', 'photoprism', 'sillytavern', 'st-uplink', 'status']);
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
        'Trust Proxy', 'Discord', 'slug `lab`', 'lab-status_kuma_data', 'docker stop',
        // The dashboard's page answers even when its state is broken; only /api/ready reports that.
        'https://dashboard.<LAB_DOMAIN>/api/ready']) {
        assert.ok(guide.includes(needle), `docs/DEPLOY.md does not mention ${needle}`);
    }
});

test('the deploy guide checks the CA file and claims the Kuma admin account at once', () => {
    const guide = read('docs/DEPLOY.md');
    assert.ok(guide.includes('test -f "$HOMELAB_CA_ROOT"') || guide.includes('test -f /usr/local/share/ca-certificates/homelab-proxy-root.crt'),
        'DEPLOY.md must check the CA file exists before starting');
    assert.ok(guide.includes('ssh -L 3001:'), 'DEPLOY.md must offer the SSH-tunnel first run');
    assert.match(guide, /straight away/, 'DEPLOY.md must say to finish Kuma setup straight away');
});

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

module.exports = { ROOT, read, code, block, service, envFile, envExample, KUMA_HOSTS };
