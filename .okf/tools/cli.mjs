#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function main() {
    // Resolve direct dependencies before loading the runtime's static imports.
    // Errors in the runtime or a parser's own dependencies retain their diagnostics.
    for (const dependency of ['yaml', 'markdown-it']) {
        try {
            import.meta.resolve(dependency);
        } catch (error) {
            if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.startsWith(`Cannot find package '${dependency}' imported from `)) throw error;
            const directory = path.dirname(fileURLToPath(import.meta.url));
            throw new Error(`OKF parser dependency '${dependency}' is missing; run: npm ci --prefix "${directory}" --ignore-scripts --no-audit --no-fund`);
        }
    }
    const { check } = await import('./check.mjs');
    const { index, init, inventory } = await import('./scaffold.mjs');
    const { verify, verificationUsage } = await import('./verify.mjs');
    const usage = `Usage: node cli.mjs check|index|init|inventory PATH [--json]\n${verificationUsage}`;
    const [command, target, ...flags] = process.argv.slice(2);
    if (command === 'verify') return verify(target, flags);
    if (!['check', 'index', 'init', 'inventory'].includes(command) || !target || target.startsWith('--') || flags.some(f => f !== '--json') || flags.length > 1 || (flags.length && !['check', 'inventory'].includes(command))) throw new Error(usage);
    const project = path.resolve(target);
    if (command === 'check') {
        const diagnostics = check(project);
        const errors = diagnostics.filter(d => d.severity === 'error').length;
        const warnings = diagnostics.filter(d => d.severity === 'warning').length;
        if (flags.includes('--json')) console.log(JSON.stringify({ project, errors, warnings, diagnostics }, null, 2));
        else {
            for (const d of diagnostics) console.log(`${d.severity}: ${d.file} [${d.code}] ${d.message}`);
            console.log(`OKF: ${errors} error(s), ${warnings} warning(s).`);
        }
        process.exitCode = errors ? 1 : 0;
    } else if (command === 'index') console.log(`Updated ${index(project)} index file(s).`);
    else if (command === 'init') {
        console.log(`Created ${init(project)} files in ${project}.`);
        console.log('Next: customize docs/overview.md; add README/AGENTS links to docs/index.md.');
        console.log('In the target project run: npm ci --prefix .okf/tools --ignore-scripts --no-audit --no-fund');
        console.log('Then run: node .okf/tools/cli.mjs check .');
    } else {
        const projects = inventory(project);
        if (flags.includes('--json')) console.log(JSON.stringify(projects, null, 2));
        else for (const p of projects) console.log(`${p.name}: ${p.adoption}; ${p.documents} documents; ${p.errors} errors, ${p.warnings} warnings`);
    }
}

try {
    await main();
} catch (error) {
    console.error(error.message);
    process.exitCode = 2;
}
