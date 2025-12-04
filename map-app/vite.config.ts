import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
  ],
  server: {
    port: 3001, // Different port from narrative-app
  },
  optimizeDeps: {
    exclude: ['@automerge/automerge/next', '@automerge/automerge'],
  },
});
