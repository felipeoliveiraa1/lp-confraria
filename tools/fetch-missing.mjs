// Downloads wp-content/uploads assets that the snapshot referenced but never
// captured (custom fonts, bonus images, section backgrounds). Saves them to
// public/assets/wpup_<path> — the same naming build-lp.mjs rewrites refs to.
// Idempotent: skips files already present.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SNAP = join(ROOT, 'lp03.confrariadodolar.com.br_al_bio');
const OUT = join(ROOT, 'public/assets');
mkdirSync(OUT, { recursive: true });

// Collect every uploads URL referenced by the snapshot HTML + its CSS files.
let blobs = [readFileSync(join(SNAP, 'index.html'), 'utf8')];
const snapAssets = join(SNAP, 'assets');
for (const n of readdirSync(snapAssets)) {
  if (n.endsWith('.css')) blobs.push(readFileSync(join(snapAssets, n), 'utf8'));
}
const text = blobs.join('\n');

const re = /https:\/\/lp03\.confrariadodolar\.com\.br\/wp-content\/uploads\/([^"')\s?#]+)(\?[^"')\s]*)?/g;
const seen = new Map(); // localName -> fetchUrl
let m;
while ((m = re.exec(text))) {
  const pathAfter = m[1];
  const local = 'wpup_' + pathAfter.replace(/\//g, '-');
  const fetchUrl = 'https://lp03.confrariadodolar.com.br/wp-content/uploads/' + pathAfter;
  if (!seen.has(local)) seen.set(local, fetchUrl);
}

console.log('Unique uploads referenced:', seen.size);
let downloaded = 0, skipped = 0, failed = [];
for (const [local, url] of seen) {
  const dest = join(OUT, local);
  if (existsSync(dest)) { skipped++; continue; }
  try {
    const res = await fetch(url);
    if (!res.ok) { failed.push(`${url} -> ${res.status}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    downloaded++;
    process.stdout.write(`.${downloaded % 50 === 0 ? '\n' : ''}`);
  } catch (e) {
    failed.push(`${url} -> ${e.message}`);
  }
}
console.log(`\nDownloaded=${downloaded} skipped=${skipped} failed=${failed.length}`);
if (failed.length) console.log('FAILED:\n' + failed.join('\n'));
