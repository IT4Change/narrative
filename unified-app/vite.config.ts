import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import basicSsl from '@vitejs/plugin-basic-ssl';

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
// Custom domain deployment: only use app name as subpath
const base = isGithubActions ? '/unified/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    basicSsl(), // Enable HTTPS for local development (required for crypto.subtle)
    // PWA disabled for testing phase - re-enable later for offline support
    // VitePWA({ ... })
  ],
  server: {
    port: 3003,
    open: true,
  },
  optimizeDeps: {
    exclude: ['@automerge/automerge', '@automerge/automerge/next'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          'vendor-react': ['react', 'react-dom'],
          'vendor-automerge': [
            '@automerge/automerge',
            '@automerge/automerge-repo',
            '@automerge/automerge-repo-react-hooks',
            '@automerge/automerge-repo-network-websocket',
            '@automerge/automerge-repo-storage-indexeddb',
          ],
          'vendor-map': ['leaflet'],
        },
      },
    },
  },
});
