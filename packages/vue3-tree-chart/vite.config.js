import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Vue3TreeChart',
      fileName: (format) => `vue3-tree-chart.${format === 'es' ? 'esm' : 'umd'}.js`,
    },
    rollupOptions: {
      external: ['vue', '@bencamus/tree-chart-core'],
      output: {
        globals: {
          vue: 'Vue',
          '@bencamus/tree-chart-core': 'TreeChartCore',
        },
      },
    },
  },
});