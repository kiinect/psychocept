import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` -> dist/ (multi-file); `npm run build:single` -> dist-single/index.html (one self-contained file)
const single = process.env.SINGLE === '1';
export default {
  base: './',
  plugins: single ? [viteSingleFile()] : [],
  build: single ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false } : {},
  test: { include: ['src/**/*.test.ts', 'tools/**/*.test.ts'] },
};
