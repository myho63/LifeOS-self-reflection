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
/* No build stamp. The dashboard showed one so a viewer could tell a cached
   copy from a fixed one; nothing here displays it, and stamping the time
   anyway made every rebuild a one-line diff — so a fresh clone went dirty the
   moment anyone ran the build. The output is a pure function of the source
   now, which is a more useful property for a repository people will clone. */
const html = template.replace(marker, () => code);

// Committed beside the source rather than written into dist/, which is
// gitignored: the point of this file is that someone can clone the repo and
// double-click it, and a build artifact you have to build first is not that.
const out = join(here, 'self-reflection.html');
await writeFile(out, html);

console.log(`${out}  ${(html.length / 1024).toFixed(0)} KB  (engine ${(code.length / 1024).toFixed(0)} KB)`);
