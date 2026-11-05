import { readFile, mkdir, writeFile } from 'node:fs/promises';
const base = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', base), 'utf8'));
const sources = await Promise.all(['model.js', 'style.js', 'editor.js', 'card.js'].map(f => readFile(new URL(`src/${f}`, base), 'utf8')));
const body = sources.map(s => s.replace(/^export /gm, '')).join('\n');
const bundle = `/* Planning de chauffe ${pkg.version} | Euro-Locks Belgium */\n(() => {\n'use strict';\nconst VERSION = ${JSON.stringify(pkg.version)};\n${body}\n})();\n`;
await mkdir(new URL('dist/', base), { recursive: true });
await writeFile(new URL('dist/ha-planning-chauffe-card.js', base), bundle);
console.log(`Built ${Buffer.byteLength(bundle)} bytes, version ${pkg.version}`);
