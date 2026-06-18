// Transforms the WordPress/LiteSpeed snapshot of lp03.confrariadodolar.com.br/al-bio/
// into a clean, self-contained static page for Astro + Vercel.
//
// What it does:
//  - Parses the snapshot ASSET_MAP (original URL -> local file).
//  - Rewrites every asset reference to absolute /assets/... paths.
//  - Removes the snapshot offline-resolver and the LiteSpeed defer loader.
//  - Converts LiteSpeed-deferred scripts (type="litespeed/javascript" + data-src)
//    back into normal <script defer src> so they actually run on page load.
//  - Strips dead WordPress endpoints (feed, xmlrpc, oembed, wp-json, canonical to old domain).
//  - Copies assets (images/fonts/css/js) to public/assets, rewriting url() inside CSS.
//    Skips the local VSL stream chunks (.ts/.m3u8/.mp4) — the player streams from the CDN.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SNAP = join(ROOT, 'lp03.confrariadodolar.com.br_al_bio');
const SNAP_ASSETS = join(SNAP, 'assets');
const OUT_PAGE = join(ROOT, 'src/pages/index.html');
const OUT_ASSETS = join(ROOT, 'public/assets');

mkdirSync(join(ROOT, 'src/pages'), { recursive: true });
mkdirSync(OUT_ASSETS, { recursive: true });

let html = readFileSync(join(SNAP, 'index.html'), 'utf8');

// ---------------------------------------------------------------------------
// 1. Parse ASSET_MAP { "https://original/url": "assets/localfile", ... }
// ---------------------------------------------------------------------------
const mapStart = html.indexOf('{', html.indexOf('var ASSET_MAP'));
const mapEnd = html.indexOf('};', mapStart);
const ASSET_MAP = JSON.parse(html.slice(mapStart, mapEnd + 1));
console.log('ASSET_MAP entries:', Object.keys(ASSET_MAP).length);

// Build [from, to] replacement pairs (longest first to avoid partial clobbers).
// `to` is the web-absolute path. Skip stream chunks / dead endpoints in `to`
// later; here we still rewrite refs so nothing points at the old WP origin.
const pairs = Object.entries(ASSET_MAP)
  .map(([url, local]) => [url, '/' + local.replace(/^\/+/, '')])
  .sort((a, b) => b[0].length - a[0].length);

// Assets the snapshot referenced but never downloaded (custom fonts, bonus
// images, section backgrounds) live on the original WP server. fetch-missing.mjs
// downloads them to public/assets/wpup_<path>. Both scripts derive the same name.
function wpUploadLocal(pathAfterUploads) {
  return 'wpup_' + pathAfterUploads.replace(/\//g, '-');
}

function rewriteUrls(text) {
  for (const [from, to] of pairs) {
    if (text.includes(from)) text = text.split(from).join(to);
    // entity-encoded ampersand variant used inside HTML attributes
    const amp = from.replace(/&/g, '&amp;');
    if (amp !== from && text.includes(amp)) text = text.split(amp).join(to);
  }
  // Any remaining wp-content/uploads ref (not in ASSET_MAP) -> local wpup_ file.
  // Strips ?query (cache busters / #iefix) but keeps #svg-font fragments.
  text = text.replace(
    /https:\/\/lp03\.confrariadodolar\.com\.br\/wp-content\/uploads\/([^"')\s?#]+)(\?[^"')\s]*)?/g,
    (m, p) => '/assets/' + wpUploadLocal(p),
  );
  return text;
}

// ---------------------------------------------------------------------------
// 2. Remove a <script>…</script> block by a signature string in its contents.
// ---------------------------------------------------------------------------
function removeScriptsContaining(signatures) {
  const re = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  html = html.replace(re, (m) => (signatures.some((s) => m.includes(s)) ? '' : m));
}

// Snapshot offline resolver + any helper that references its globals.
removeScriptsContaining([
  'data-offline-resolve',
  '__resolveLocal',
  '__offlineDataUri',
  'ASSET_MAP',
  'resolveLocal(',
  'patchSetter(',
]);

// Dead on a static host: the Cloudflare RUM beacon only posts to /cdn-cgi/rum,
// which 404s off WordPress/Cloudflare. Pure wasted request — drop it.
removeScriptsContaining(['data-cf-beacon', 'cloudflareinsights']);

// Tracking weight cleanup (no data loss):
//  - The snapshot hard-coded two FB pixel CONFIG loaders (~130KB each) pinned to
//    domain=lp03… — fbevents.js fetches the right config for the live domain by
//    itself when fbq('init') runs, so these are redundant AND stale. Drop them.
//  - fbevents.js was included twice; keep one.
html = html.replace(/<script\b[^>]*connect\.facebook\.net\/signals\/config\/[^>]*><\/script>/gi, '');
let _fbev = 0;
html = html.replace(/<script\b[^>]*connect\.facebook\.net\/en_US\/fbevents\.js[^>]*><\/script>/gi,
  (m) => (++_fbev > 1 ? '' : m));

// Open connections to the third-party origins the page hits during load
// (VSL stream, Pixel, GTM, fonts) as early as possible — pure speed, no visual
// change. The original dns-prefetch hints were dropped in cleanup; re-add the
// stronger preconnect form right at the top of <head>.
const PRECONNECTS = [
  '<link rel="preconnect" href="https://cdn.converteai.net" crossorigin>',
  '<link rel="preconnect" href="https://scripts.converteai.net" crossorigin>',
  '<link rel="preconnect" href="https://images.converteai.net" crossorigin>',
  '<link rel="preconnect" href="https://connect.facebook.net" crossorigin>',
  '<link rel="preconnect" href="https://www.googletagmanager.com">',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  // Preload the brand font so headings/body paint in the right face from the
  // first frame — avoids the swap reflow that was driving CLS up to 0.46.
  '<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/wpup_2026-06-InstrumentSansCondensed-Regular.woff2">',
  '<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/wpup_2026-06-InstrumentSansCondensed-SemiBold.woff2">',
].join('');
html = html.replace('<head>', '<head>' + PRECONNECTS);

// ---------------------------------------------------------------------------
// 3. Convert LiteSpeed-deferred scripts to normal deferred scripts FIRST, so
//    that afterwards the ONLY thing still mentioning litespeed/javascript is the
//    loader itself (which we then delete) — not the real elementor/jquery tags.
//    <script data-optimized="1" data-src="…" type="litespeed/javascript">  (external)
//    <script type="litespeed/javascript">…inline…</script>                  (inline)
// ---------------------------------------------------------------------------
html = html.replace(/<script\b([^>]*)>/gi, (full, attrs) => {
  if (!/litespeed\/javascript/i.test(attrs)) return full;
  let a = attrs
    .replace(/\s*type=["']litespeed\/javascript["']/i, '')
    .replace(/\s*data-optimized=["'][^"']*["']/i, '')
    .replace(/\sdata-src=/i, ' src=');
  // Keep them SYNCHRONOUS and in document order (jquery -> migrate -> elementor
  // -> widgets -> inline init), exactly like a normal (non-LiteSpeed) WordPress
  // footer. Adding defer would let the inline -before/-after init snippets run
  // before their library loaded (jQuery is not defined / wp is not defined).
  return '<script' + a + ' type="text/javascript">';
});

// Now remove the LiteSpeed loader + referrer shim. After the conversion above,
// nothing else still references the litespeed/javascript type string.
removeScriptsContaining([
  'litespeed_docref',
  'litespeed/javascript',
  'LiteSpeedFramework',
]);

// ---------------------------------------------------------------------------
// 4. Rewrite all remaining asset URLs (full WP URLs + snapshot-relative).
// ---------------------------------------------------------------------------
html = rewriteUrls(html);
// snapshot-relative refs like  src="assets/x"  href="assets/x"  url(assets/x)
html = html
  .replace(/(["'(])assets\//g, '$1/assets/')
  .replace(/\/\/assets\//g, '/assets/'); // guard against double slash

// ---------------------------------------------------------------------------
// 5. Strip dead WordPress <link> tags (old-domain / endpoints that won't exist).
// ---------------------------------------------------------------------------
const deadRel = [
  'alternate', 'EditURI', 'pingback', 'wlwmanifest', 'shortlink',
  'canonical', 'https://api.w.org/', 'dns-prefetch',
];
html = html.replace(/<link\b[^>]*>/gi, (m) => {
  const rel = (m.match(/rel=["']([^"']+)["']/i) || [])[1] || '';
  // keep stylesheet / preload / preconnect / icon
  if (/stylesheet|preload|preconnect|icon|modulepreload/i.test(rel)) return m;
  if (deadRel.some((r) => rel.split(/\s+/).includes(r) || rel === r)) return '';
  // also drop links pointing at WP json/feed/xmlrpc snapshot files
  if (/_file\b|file\.json|file\.html|embed\.json|_embed\b|xmlrpc|786\.json|feed/i.test(m)) return '';
  return m;
});
// keep dns-prefetch/preconnect to the video + font CDNs (re-add the useful ones in <head> manually if needed)

// ---------------------------------------------------------------------------
// 5b. Make Elementor "Motion Effects" background images show statically.
//     Section/bonus images are applied as background-image on a rule like:
//       .elementor-element-X:not(.elementor-motion-effects-element-type-background),
//       .elementor-element-X > .elementor-motion-effects-container > .layer { background-image:url(...) }
//     Elementor Pro's parallax JS adds the *-type-background class (killing the
//     :not() match) and is supposed to paint the moving .layer instead. On this
//     static export that JS errors ("reading 'width'"), so neither selector wins
//     and the image vanishes. Dropping the :not() guard makes the background
//     paint directly on the element, always — image shows (just without parallax).
// ---------------------------------------------------------------------------
const MOTION_FX_NOT = ':not(.elementor-motion-effects-element-type-background)';
html = html.split(MOTION_FX_NOT).join('');

// font-display:swap on every @font-face — text paints instantly in a fallback
// instead of staying invisible ~3s (default block) while the webfont downloads.
// The brand woff2 are preloaded, so the swap window is tiny. Big FCP win.
html = html.replace(/font-display\s*:\s*[a-z-]+\s*;?/gi, '');
html = html.replace(/@font-face\s*\{/gi, '@font-face{font-display:swap;');

// ---------------------------------------------------------------------------
// 5c. Performance: lazy backgrounds + delayed heavy JS (no visual change).
//     Elementor gates container background-images behind
//       .e-con.e-parent:nth-of-type(n+4):not(.e-lazyloaded){ background-image:none }
//     and only paints them once `.e-lazyloaded` is added by JS on scroll. Its own
//     handler doesn't fire on this static export, so instead of baking the class
//     on EVERY container (which eager-loads ~1MB of images up front and tanks LCP),
//     a tiny IntersectionObserver adds it as each container nears the viewport —
//     above-the-fold paints immediately, the rest stream in on scroll.
//
//     The ~1MB of Elementor/jQuery/Swiper footer JS only powers below-the-fold
//     interactions (carousel, accordion, animations) and secondary PixelYourSite
//     events — nothing needed for first paint, and the CTAs are plain <a> links.
//     So those scripts are marked type="text/lazyscript" and replayed (in order)
//     on first interaction / shortly after load. The Meta Pixel PageView + GTM +
//     GA stay eager in <head>, untouched — connect-rate tracking is unaffected.
// ---------------------------------------------------------------------------
// (a) Elementor/jQuery/Swiper footer bundle -> text/lazyscript (interaction-only).
const DELAY_ID = /(jquery|elementor|swiper|happy|wp-i18n|wp-hooks|dom-purify|js-cookie|js-tld|pro-elements|hello-theme|pys-js)/i;
html = html.replace(/<script\b([^>]*)>/gi, (full, attrs) => {
  const idm = attrs.match(/\bid="([^"]*)"/i);
  if (!idm || !DELAY_ID.test(idm[1])) return full;
  let a = /type=/.test(attrs)
    ? attrs.replace(/type=["'][^"']*["']/i, 'type="text/lazyscript"')
    : attrs + ' type="text/lazyscript"';
  return '<script' + a + '>';
});

// (b) Third-party tracking (~650KB: GTM, GA/gtag, Meta fbevents, CAPI param
//     builder) -> text/delaytrack. The fbq() stub + dataLayer stay EAGER so
//     PageView/events queue at parse; these heavy loaders flush the queue once
//     they run, scheduled right after the page paints (requestIdleCallback) so
//     they never compete with the hero/LCP for mobile bandwidth. Always fire
//     (no interaction needed) — connect-rate Pixel stays intact (~1s post-paint).
const TRACK_SRC = /(googletagmanager\.com\/(gtag|gtm)|connect\.facebook\.net\/en_US\/fbevents|clientParamBuilder)/i;
html = html.replace(/<script\b([^>]*)>/gi, (full, attrs) => {
  if (!/\ssrc=/.test(attrs) || !TRACK_SRC.test(attrs)) return full;
  let a = /type=/.test(attrs)
    ? attrs.replace(/type=["'][^"']*["']/i, 'type="text/delaytrack"')
    : attrs + ' type="text/delaytrack"';
  return '<script' + a + '>';
});
// the inline GTM bootstrap (injects gtm.js) — delay it too (single-line snippet)
html = html.replace(/<script>([^<]*gtm\.start[^<]*)<\/script>/i,
  '<script type="text/delaytrack">$1</script>');

const PERF_LOADER = `<script>(function(){
// lazy background-images: add .e-lazyloaded as each container nears the viewport
var cons=[].slice.call(document.querySelectorAll('.e-con'));
if('IntersectionObserver' in window){
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){e.target.classList.add('e-lazyloaded');io.unobserve(e.target);}});},
    {rootMargin:'800px 0px'});
  cons.forEach(function(c){io.observe(c);});
}else{cons.forEach(function(c){c.classList.add('e-lazyloaded');});}
// replay a set of held scripts in DOM order (inline run sync, external await load)
function replay(type){
  var q=[].slice.call(document.querySelectorAll('script[type="'+type+'"]'));
  (function next(i){if(i>=q.length)return;var o=q[i],s=document.createElement('script');
    for(var j=0;j<o.attributes.length;j++){var at=o.attributes[j];if(at.name!=='type')s.setAttribute(at.name,at.value);}
    s.type='text/javascript';
    if(o.getAttribute('src')){s.onload=s.onerror=function(){next(i+1);};o.parentNode.replaceChild(s,o);}
    else{s.text=o.textContent;o.parentNode.replaceChild(s,o);next(i+1);}
  })(0);
}
var tDone=false,mDone=false;
function loadTrack(){if(tDone)return;tDone=true;replay('text/delaytrack');}
function loadMain(){if(mDone)return;mDone=true;replay('text/lazyscript');}
// tracking: as soon as the page is idle after load — always fires (no interaction).
function schedTrack(){('requestIdleCallback'in window)?requestIdleCallback(loadTrack,{timeout:2500}):setTimeout(loadTrack,1500);}
if(document.readyState==='complete')schedTrack();else window.addEventListener('load',schedTrack);
// Elementor interactions: only on first engagement (scroll/touch/move/key/click),
// which also pulls tracking forward. CTAs are <a> links, FAQ is native <details>.
function onEngage(){loadTrack();loadMain();}
['scroll','mousemove','touchstart','pointerdown','keydown','click','wheel']
  .forEach(function(e){window.addEventListener(e,onEngage,{once:true,passive:true});});
})();</script>`;
html = html.replace('</body>', PERF_LOADER + '</body>');

// Lazy-load every <img>: none sit above the fold (the hero is the VSL player +
// headline text), so only images near the viewport download — the rest stream
// in on scroll. Cuts ~600KB off the initial load (testimonial carousel + thumbs).
html = html.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async" ');

// ---------------------------------------------------------------------------
// 5d. GTM <noscript> fallback. The head gtm.js snippet is present, but the
//     snapshot lacked the no-JS iframe that normally sits right after <body>.
//     Add it so the GTM install is complete (container GTM-TXZ8KFR7).
// ---------------------------------------------------------------------------
const GTM_NOSCRIPT =
  '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TXZ8KFR7" ' +
  'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>';
if (!html.includes('googletagmanager.com/ns.html')) {
  html = html.replace(/(<body[^>]*>)/i, '$1' + GTM_NOSCRIPT);
}

// ---------------------------------------------------------------------------
// 6. Write the page.
// ---------------------------------------------------------------------------
writeFileSync(OUT_PAGE, html);
console.log('Wrote', OUT_PAGE, '(', (html.length / 1024).toFixed(0), 'KB )');

// ---------------------------------------------------------------------------
// 7. Copy assets to public/assets. Skip VSL stream chunks + dead snapshot junk.
//    Rewrite url() inside CSS so backgrounds/fonts resolve locally too.
// ---------------------------------------------------------------------------
const SKIP_EXT = new Set(['.ts', '.mp4', '.m3u8']);
const SKIP_NAME = [
  /_file$/, /_file\./, /file\.html$/, /file\.json$/, /_embed$/, /embed\.json$/,
  /_collect$/, /sw_iframe/, /xmlrpc/, /786\.json$/, /\.php$/, /840be6fd/, /1c70cc66/,
];
let copied = 0, skipped = 0, cssRewritten = 0;
for (const name of readdirSync(SNAP_ASSETS)) {
  const src = join(SNAP_ASSETS, name);
  if (!statSync(src).isFile()) continue;
  const ext = (name.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
  if (SKIP_EXT.has(ext) || SKIP_NAME.some((re) => re.test(name))) { skipped++; continue; }
  if (ext === '.css') {
    let css = readFileSync(src, 'utf8');
    css = rewriteUrls(css).replace(/(["'(])assets\//g, '$1/assets/');
    css = css.split(':not(.elementor-motion-effects-element-type-background)').join('');
    writeFileSync(join(OUT_ASSETS, name), css);
    cssRewritten++; copied++;
  } else {
    copyFileSync(src, join(OUT_ASSETS, name));
    copied++;
  }
}
console.log(`assets: copied=${copied} (css rewritten=${cssRewritten}) skipped=${skipped}`);
