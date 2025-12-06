import { createViteConfig } from '../shared-config/vite.base';

export default createViteConfig({
  appName: 'unified',
  port: 3003,
  extend: {
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
  },
});
