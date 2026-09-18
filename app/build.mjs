import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Builds Self Reflection into one self-contained HTML file.
 *
 * The whole point is that the numbers on screen are the real ones:
 * `@lifeos/core` is bundled and run in the page, so the eleven impact levels,
 * the month readings and the year curve are computed by the engine in
 * `packages/core` rather than written into the markup. Change the engine and
 * this page changes with it — which is also why `packages/core/test` is worth
 * running before you trust anything the page says.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const bundle = await build({
  entryPoints: [join(root, 'packages/core/src/index.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'LifeOS',
  target: 'es2020',
  minify: true,
  write: false,
});

const code = bundle.outputFiles[0].text;
const template = await readFile(join(here, 'index.html'), 'utf8');

const marker = '/*__LIFEOS_CORE__*/';
if (!template.includes(marker)) throw new Error(`index.html is missing ${marker}`);

// `$` is special in String.replace patterns, and a minified bundle is full of
// them. A function replacement passes the text through untouched.
// Stamped so a page on screen can say which build it is. A viewer can serve a
// cached copy, and without this there is no telling a fixed page from an old
// one that looks identical.
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const html = template
  .replace(marker, () => code)
  .replaceAll('__BUILD__', () => stamp);

// Committed beside the source rather than written into dist/, which is
// gitignored: the point of this file is that someone can clone the repo and
// double-click it, and a build artifact you have to build first is not that.
const out = join(here, 'self-reflection.html');
await writeFile(out, html);

console.log(`${out}  ${(html.length / 1024).toFixed(0)} KB  (engine ${(code.length / 1024).toFixed(0)} KB)`);
