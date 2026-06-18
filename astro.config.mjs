import { defineConfig } from 'astro/config';

// Static landing page (lift-and-shift of the WordPress LP). The page itself is a
// plain HTML file at src/pages/index.html, served as-is; assets live in public/assets.
// Output is fully static -> Vercel serves it from the edge CDN (fast connect rate).
export default defineConfig({
  output: 'static',
  build: {
    // keep asset filenames predictable; our page references /assets/* directly
    assets: '_astro',
  },
});
