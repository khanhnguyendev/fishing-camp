// npm run build        -> dist/: the folder build, for shipping (itch.io, a website)
// npm run build:single -> dist-single/index.html: one file with everything
//                         inlined, which every check opens from disk
// Vitest reads the test block; Playwright has its own config.
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  // Relative paths, so the build works from any folder, itch.io included.
  base: './',
  // Assets are imported in the code (new URL('../assets/x.png', import.meta.url)),
  // so Vite hashes them and the single file inlines them. public/ holds only the
  // home-screen manifest and its icon, which must keep their names: the folder
  // build ships them; the single file (checks only) goes without.
  publicDir: mode === 'single' ? false : 'public',
  // The single file has no public/ folder, so it drops the manifest and icon links that point there.
  plugins: mode === 'single' ? [viteSingleFile(), {
    name: 'single-drops-public-links',
    transformIndexHtml: (html: string) => html.replace(/<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\s*/g, ''),
  }] : [],
  // The game's page only: other pages in the project (one-shots in prototypes/)
  // are not scanned for packages.
  optimizeDeps: { entries: ['index.html'] },
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    emptyOutDir: true,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
}));
