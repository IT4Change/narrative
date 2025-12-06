import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
// Custom domain deployment: only use app name as subpath
const base = isGithubActions ? '/unified/' : '/';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    base,
    plugins: [
      react(),
      wasm(),
      topLevelAwait(),
      // PWA disabled for testing phase - re-enable later for offline support
      // VitePWA({ ... })
    ],
    resolve: {
      alias: isDev
        ? {
            // In dev mode, use source files directly for HMR
            'narrative-ui': path.resolve(__dirname, '../lib/src/index.ts'),
          }
        : undefined,
    },
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
  };
});
