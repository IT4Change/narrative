/**
 * useCrossTabSync - Hook for cross-tab synchronization
 *
 * Uses BroadcastChannel API for reliable cross-tab communication.
 * Falls back to localStorage events for browsers without BroadcastChannel support.
 *
 * This enables real-time updates across multiple browser tabs
 * without relying solely on Automerge sync.
 */

import { useEffect, useCallback } from 'react';
import type { StoredIdentity } from '../utils/storage';
import { loadSharedIdentity } from '../utils/storage';
import { loadUserDocId } from './useUserDocument';

const SHARED_IDENTITY_KEY = 'narrative_shared_identity';
const USER_DOC_KEY = 'narrative_user_doc_id';
const BROADCAST_CHANNEL_NAME = 'narrative_cross_tab_sync';

// Message types for BroadcastChannel
interface SyncMessage {
  type: 'identity_changed' | 'user_doc_changed' | 'profile_updated';
  payload: {
    displayName?: string;
    avatarUrl?: string;
    did?: string;
    userDocId?: string;
  };
  timestamp: number;
}

// Singleton BroadcastChannel for the app
let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
  return broadcastChannel;
}

export interface CrossTabSyncOptions {
  /**
   * Called when identity changes in another tab
   * Return true to reload the page, false to handle manually
   */
  onIdentityChange?: (newIdentity: StoredIdentity | null) => boolean | void;

  /**
   * Called when user document ID changes in another tab
   */
  onUserDocChange?: (newDocId: string | null) => void;

  /**
   * Called when profile is updated in another tab (name, avatar)
   * This allows reactive UI updates without page reload
   */
  onProfileUpdate?: (profile: { displayName?: string; avatarUrl?: string }) => void;

  /**
   * Enable automatic page reload on identity change
   * @default true
   */
  autoReloadOnIdentityChange?: boolean;
}

/**
 * Hook for cross-tab synchronization of identity and user document
 *
 * @example
 * ```tsx
 * useCrossTabSync({
 *   onIdentityChange: (identity) => {
 *     console.log('Identity changed in another tab', identity);
 *     // Return true to auto-reload, false to handle manually
 *     return true;
 *   },
 *   onUserDocChange: (docId) => {
 *     console.log('User doc changed in another tab', docId);
 *   },
 *   onProfileUpdate: (profile) => {
 *     console.log('Profile updated in another tab', profile);
 *     // Update local state reactively
 *   },
 * });
 * ```
 */
export function useCrossTabSync(options: CrossTabSyncOptions = {}): void {
  const {
    onIdentityChange,
    onUserDocChange,
    onProfileUpdate,
    autoReloadOnIdentityChange = true,
  } = options;

  // Handle BroadcastChannel messages
  const handleBroadcastMessage = useCallback(
    (event: MessageEvent<SyncMessage>) => {
      const message = event.data;

      if (message.type === 'profile_updated' && onProfileUpdate) {
        console.log('🔄 [BroadcastChannel] Profile updated in another tab', message.payload);
        onProfileUpdate({
          displayName: message.payload.displayName,
          avatarUrl: message.payload.avatarUrl,
        });
      }

      if (message.type === 'identity_changed') {
        console.log('🔄 [BroadcastChannel] Identity changed in another tab');
        const newIdentity = loadSharedIdentity();
        if (onIdentityChange) {
          const shouldReload = onIdentityChange(newIdentity);
          if (shouldReload) {
            window.location.reload();
          }
        } else if (autoReloadOnIdentityChange && message.payload.did) {
          // DID changed, reload
          window.location.reload();
        }
      }

      if (message.type === 'user_doc_changed' && onUserDocChange) {
        console.log('🔄 [BroadcastChannel] User doc changed in another tab');
        onUserDocChange(message.payload.userDocId ?? null);
      }
    },
    [onIdentityChange, onUserDocChange, onProfileUpdate, autoReloadOnIdentityChange]
  );

  // Handle localStorage events (fallback for browsers without BroadcastChannel)
  const handleStorageChange = useCallback(
    (event: StorageEvent) => {
      // Identity changed in another tab
      if (event.key === SHARED_IDENTITY_KEY) {
        const oldIdentity = event.oldValue ? JSON.parse(event.oldValue) as StoredIdentity : null;
        const newIdentity = event.newValue ? JSON.parse(event.newValue) as StoredIdentity : null;

        // Check if DID actually changed (not just name/avatar)
        const didChanged = oldIdentity?.did !== newIdentity?.did;

        console.log('🔄 [localStorage] Identity changed in another tab', {
          oldDid: oldIdentity?.did?.substring(0, 30),
          newDid: newIdentity?.did?.substring(0, 30),
          didChanged,
          nameChanged: oldIdentity?.displayName !== newIdentity?.displayName,
        });

        if (onIdentityChange) {
          const shouldReload = onIdentityChange(newIdentity);
          if (shouldReload) {
            window.location.reload();
          }
        } else if (autoReloadOnIdentityChange && didChanged) {
          // Only reload if the DID actually changed (not just name/avatar)
          // Name/avatar updates come through Automerge sync via UserDocument
          console.log('🔄 DID changed, reloading page...');
          window.location.reload();
        }
      }

      // User document ID changed in another tab
      if (event.key === USER_DOC_KEY) {
        console.log('🔄 [localStorage] User document ID changed in another tab', {
          oldDocId: event.oldValue?.substring(0, 30),
          newDocId: event.newValue?.substring(0, 30),
        });

        if (onUserDocChange) {
          onUserDocChange(event.newValue);
        }
      }
    },
    [onIdentityChange, onUserDocChange, autoReloadOnIdentityChange]
  );

  useEffect(() => {
    // Set up BroadcastChannel listener
    const channel = getBroadcastChannel();
    if (channel) {
      channel.addEventListener('message', handleBroadcastMessage);
    }

    // Also listen to localStorage events as fallback
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (channel) {
        channel.removeEventListener('message', handleBroadcastMessage);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [handleBroadcastMessage, handleStorageChange]);
}

/**
 * Broadcast a profile update to all other tabs
 * Call this when the user updates their profile
 */
export function broadcastProfileUpdate(profile: { displayName?: string; avatarUrl?: string }): void {
  const channel = getBroadcastChannel();
  if (channel) {
    const message: SyncMessage = {
      type: 'profile_updated',
      payload: profile,
      timestamp: Date.now(),
    };
    channel.postMessage(message);
    console.log('📡 Broadcasting profile update to other tabs', profile);
  }
}

/**
 * Broadcast an identity change to all other tabs
 * Call this when the user's DID changes (login/logout/reset)
 */
export function broadcastIdentityChange(did?: string): void {
  const channel = getBroadcastChannel();
  if (channel) {
    const message: SyncMessage = {
      type: 'identity_changed',
      payload: { did },
      timestamp: Date.now(),
    };
    channel.postMessage(message);
    console.log('📡 Broadcasting identity change to other tabs');
  }
}

/**
 * Broadcast a user document change to all other tabs
 */
export function broadcastUserDocChange(userDocId: string): void {
  const channel = getBroadcastChannel();
  if (channel) {
    const message: SyncMessage = {
      type: 'user_doc_changed',
      payload: { userDocId },
      timestamp: Date.now(),
    };
    channel.postMessage(message);
    console.log('📡 Broadcasting user doc change to other tabs');
  }
}

/**
 * Utility to manually trigger a cross-tab sync notification via localStorage
 * (Legacy fallback for browsers without BroadcastChannel)
 */
export function notifyCrossTabSync(key: 'identity' | 'userDoc'): void {
  const storageKey = key === 'identity' ? SHARED_IDENTITY_KEY : USER_DOC_KEY;
  const currentValue = localStorage.getItem(storageKey);

  // Trigger storage event by briefly changing and restoring the value
  // Note: This only works for OTHER tabs, not the current one
  // The current tab should update its state directly
  if (currentValue) {
    // Force a storage event by appending/removing a timestamp
    // This is a workaround since storage events don't fire in the same tab
    const tempKey = `${storageKey}_sync_trigger`;
    localStorage.setItem(tempKey, Date.now().toString());
    localStorage.removeItem(tempKey);
  }
}

/**
 * Get current cross-tab state
 */
export function getCrossTabState(): {
  identity: StoredIdentity | null;
  userDocId: string | null;
} {
  return {
    identity: loadSharedIdentity(),
    userDocId: loadUserDocId(),
  };
}
