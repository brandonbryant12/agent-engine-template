import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: './src/worker.ts',
  format: 'esm',
  noExternal: [/.*/],
  external: [/\.node$/],
  platform: 'node',
  unbundle: false,
  outDir: './dist',
  clean: true,
  minify: true,
  sourcemap: true,
  outputOptions: {
    inlineDynamicImports: true,
  },
});
