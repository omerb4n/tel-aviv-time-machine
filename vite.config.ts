import { defineConfig } from 'vite';

// `base` is relative so the build works on GitHub Pages or any static host sub-path.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
