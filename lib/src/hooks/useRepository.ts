/**
 * Hook for creating and configuring Automerge Repo
 *
 * Provides a reusable way to initialize Automerge repositories
 * with storage and network adapters.
 */

import { useMemo } from 'react';
import { Repo } from '@automerge/automerge-repo';
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';

/**
 * Options for repository configuration
 */
export interface RepositoryOptions {
  /**
   * WebSocket sync server URL
   * Default: 'wss://sync.automerge.org'
   */
  syncServer?: string;

  /**
   * Enable BroadcastChannel for same-browser multi-tab sync
   * Default: false (disabled due to cross-browser sync issues)
   *
   * Note: BroadcastChannel was found to interfere with cross-browser
   * document loading via WebSocket. Only enable if same-browser
   * multi-tab sync is critical for your use case.
   */
  enableBroadcastChannel?: boolean;
}

/**
 * Hook for creating Automerge repository with browser adapters
 *
 * @param options - Repository configuration options
 * @returns Configured Automerge Repo instance
 *
 * @example
 * ```tsx
 * const repo = useRepository({
 *   syncServer: 'wss://sync.automerge.org',
 * });
 * ```
 */
export function useRepository(options: RepositoryOptions = {}): Repo {
  const {
    syncServer = 'wss://sync.automerge.org',
    enableBroadcastChannel = false,
  } = options;

  const repo = useMemo(() => {
    const networkAdapters = [];

    // WebSocket adapter for cross-device sync
    if (syncServer) {
      networkAdapters.push(new BrowserWebSocketClientAdapter(syncServer));
    }

    // BroadcastChannel adapter for same-browser multi-tab sync (optional)
    // Note: Disabled by default due to cross-browser sync issues
    if (enableBroadcastChannel) {
      // Lazy import to avoid bundling if not used
      import('@automerge/automerge-repo-network-broadcastchannel').then(
        ({ BroadcastChannelNetworkAdapter }) => {
          const adapter = new BroadcastChannelNetworkAdapter();
          repo.networkSubsystem.addNetworkAdapter(adapter);
        }
      );
    }

    return new Repo({
      storage: new IndexedDBStorageAdapter(),
      network: networkAdapters,
    });
  }, [syncServer, enableBroadcastChannel]);

  return repo;
}
