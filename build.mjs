import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('.', import.meta.url).pathname;
const jsDir = join(dir, 'src/js');
const files = readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();
const js = files.map(f => `/* ---- ${f} ---- */\n` + readFileSync(join(jsDir, f), 'utf8')).join('\n');
const tpl = readFileSync(join(dir, 'src/template.html'), 'utf8');
mkdirSync(join(dir, 'dist'), { recursive: true });
writeFileSync(join(dir, 'dist/game.mjs'), js);

const V = '0.170.0';
const build = (three, addons) => tpl.replace('__THREE__', three).replace('__ADDONS__', addons).replace('/*__JS__*/', () => js);
writeFileSync(join(dir, 'index.html'), build(`https://cdn.jsdelivr.net/npm/three@${V}/build/three.module.min.js`, `https://cdn.jsdelivr.net/npm/three@${V}/examples/jsm/`));
writeFileSync(join(dir, 'dist/test.html'), build('/node_modules/three/build/three.module.js', '/node_modules/three/examples/jsm/'));
console.log('ok', files.length, 'archivos,', (js.length / 1024).toFixed(1), 'KB de JS');
