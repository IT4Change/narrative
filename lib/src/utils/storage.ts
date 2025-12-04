/**
 * Storage utilities for shared identity management
 *
 * Provides localStorage abstraction for identity persistence
 * across multiple Narrative apps.
 */

import type { UserIdentity } from '../schema/identity';

/**
 * Shared localStorage key for identity across all Narrative apps
 * This ensures the same DID is used in narrative-app, map-app, etc.
 */
const SHARED_IDENTITY_KEY = 'narrative_shared_identity';

/**
 * Extended identity with private key for signing
 * Private key is stored locally but never synced via Automerge
 */
export interface StoredIdentity extends UserIdentity {
  privateKey?: string;  // Base64-encoded Ed25519 private key (stored locally only)
}

/**
 * Load shared identity from localStorage
 *
 * @returns Stored identity if found, null otherwise
 */
export function loadSharedIdentity(): StoredIdentity | null {
  try {
    const json = localStorage.getItem(SHARED_IDENTITY_KEY);
    if (!json) return null;

    const identity = JSON.parse(json) as StoredIdentity;

    // Validate required fields
    if (!identity.did || typeof identity.did !== 'string') {
      console.warn('Invalid identity in localStorage: missing or invalid DID');
      return null;
    }

    return identity;
  } catch (error) {
    console.error('Failed to load identity from localStorage:', error);
    return null;
  }
}

/**
 * Save shared identity to localStorage
 *
 * @param identity - Identity to save (including private key)
 */
export function saveSharedIdentity(identity: StoredIdentity): void {
  try {
    localStorage.setItem(SHARED_IDENTITY_KEY, JSON.stringify(identity));
  } catch (error) {
    console.error('Failed to save identity to localStorage:', error);
    throw error;
  }
}

/**
 * Clear shared identity from localStorage
 * Used when resetting identity or logging out
 */
export function clearSharedIdentity(): void {
  try {
    localStorage.removeItem(SHARED_IDENTITY_KEY);
  } catch (error) {
    console.error('Failed to clear identity from localStorage:', error);
  }
}

/**
 * Get document ID for a specific app
 *
 * @param appPrefix - App-specific prefix (e.g., 'narrative', 'mapapp')
 * @returns Document ID if found, null otherwise
 */
export function loadDocumentId(appPrefix: string): string | null {
  try {
    return localStorage.getItem(`${appPrefix}_docId`);
  } catch (error) {
    console.error(`Failed to load document ID for ${appPrefix}:`, error);
    return null;
  }
}

/**
 * Save document ID for a specific app
 *
 * @param appPrefix - App-specific prefix (e.g., 'narrative', 'mapapp')
 * @param documentId - Document ID to save
 */
export function saveDocumentId(appPrefix: string, documentId: string): void {
  try {
    localStorage.setItem(`${appPrefix}_docId`, documentId);
  } catch (error) {
    console.error(`Failed to save document ID for ${appPrefix}:`, error);
    throw error;
  }
}

/**
 * Clear document ID for a specific app
 *
 * @param appPrefix - App-specific prefix (e.g., 'narrative', 'mapapp')
 */
export function clearDocumentId(appPrefix: string): void {
  try {
    localStorage.removeItem(`${appPrefix}_docId`);
  } catch (error) {
    console.error(`Failed to clear document ID for ${appPrefix}:`, error);
  }
}
