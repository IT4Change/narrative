/**
 * useKnownProfiles - Central hook for managing all known user profiles
 *
 * This hook provides a single source of truth for user profiles from:
 * - Own profile (from userDoc.profile)
 * - 1st degree: Users I trust (trustGiven) and users who trust me (trustReceived)
 * - 2nd degree: Friends of friends (limited to 50)
 * - Workspace identities (as fallback)
 * - Externally registered docs (e.g., from QR scanner)
 *
 * IMPLEMENTATION NOTE:
 * This hook is now a thin wrapper around KnownProfilesProvider context.
 * The actual profile loading is done via React hooks (useDocument) in UserDocLoader components.
 * This ensures automatic reactivity without manual subscriptions.
 *
 * MIGRATION:
 * - For new code, prefer using KnownProfilesProvider + useKnownProfilesContext directly.
 * - This wrapper exists for backwards compatibility with existing components.
 */

import { useMemo } from 'react';
import type { Repo } from '@automerge/automerge-repo';
import type { UserDocument } from '../schema/userDocument';
import type { BaseDocument } from '../schema/document';
import { useKnownProfilesContextOptional } from './useKnownProfilesContext';
import type { TrackedProfile } from '../providers/types';

// ============================================================================
// Type Exports (kept for backwards compatibility)
// ============================================================================

/** Profile signature verification status */
export type ProfileSignatureStatus = 'valid' | 'invalid' | 'missing' | 'pending';

/** Source of profile data - indicates trust distance */
export type ProfileSource =
  | 'self' // Own profile
  | 'trust-given' // User I trust (1st degree)
  | 'trust-received' // User who trusts me (1st degree)
  | 'network-2nd' // Friend of a friend (2nd degree)
  | 'external' // Registered externally (e.g., QR scan before trust)
  | 'workspace'; // Workspace identity (fallback)

/** Known profile with metadata */
export interface KnownProfile {
  did: string;
  displayName?: string;
  avatarUrl?: string;
  userDocUrl?: string;
  source: ProfileSource;
  signatureStatus: ProfileSignatureStatus;
  lastUpdated: number;
}

/** Options for useKnownProfiles hook */
export interface UseKnownProfilesOptions {
  repo: Repo | null;
  userDoc: UserDocument | null;
  currentUserDid: string;
  workspaceDoc?: BaseDocument | null;
}

/** Return type for useKnownProfiles hook */
export interface UseKnownProfilesResult {
  /** All known profiles indexed by DID */
  profiles: Map<string, KnownProfile>;
  /** Get a specific profile by DID */
  getProfile: (did: string) => KnownProfile | undefined;
  /** Whether initial loading is in progress */
  isLoading: boolean;
  /** Register an external UserDoc URL for reactive updates (e.g., from QR scanner)
   * @param userDocUrl - The URL of the user's document
   * @param expectedDid - The DID we expect the document to contain
   * @param displayName - Optional display name from QR code (used as placeholder until document loads)
   */
  registerExternalDoc: (userDocUrl: string, expectedDid?: string, displayName?: string) => void;
}

// ============================================================================
// Helper: Convert TrackedProfile to KnownProfile
// ============================================================================

function trackedToKnown(tracked: TrackedProfile): KnownProfile {
  return {
    did: tracked.did,
    displayName: tracked.displayName,
    avatarUrl: tracked.avatarUrl,
    userDocUrl: tracked.userDocUrl,
    source: tracked.source,
    signatureStatus: tracked.signatureStatus,
    lastUpdated: tracked.lastUpdated,
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook that provides known profiles from the KnownProfilesProvider context.
 *
 * NOTE: This hook requires KnownProfilesProvider to be present in the component tree.
 * The options parameter is kept for backwards compatibility but is ignored when
 * using the provider (the provider has its own props for configuration).
 *
 * @param _options - Configuration options (ignored when provider is present)
 * @returns Object with profiles, getProfile, isLoading, and registerExternalDoc
 */
export function useKnownProfiles(_options: UseKnownProfilesOptions): UseKnownProfilesResult {
  const context = useKnownProfilesContextOptional();

  // Convert TrackedProfile to KnownProfile for backwards compatibility
  const profiles = useMemo(() => {
    if (!context) return new Map<string, KnownProfile>();

    const result = new Map<string, KnownProfile>();
    for (const [did, tracked] of context.profiles) {
      result.set(did, trackedToKnown(tracked));
    }
    return result;
  }, [context?.profiles]);

  // Wrap getProfile to return KnownProfile instead of TrackedProfile
  const getProfile = useMemo(() => {
    if (!context) return () => undefined;

    return (did: string): KnownProfile | undefined => {
      const tracked = context.getProfile(did);
      return tracked ? trackedToKnown(tracked) : undefined;
    };
  }, [context?.getProfile]);

  // Return default values if context is not available
  if (!context) {
    console.warn(
      '[useKnownProfiles] KnownProfilesProvider not found in component tree. ' +
      'Profile loading will not work. Make sure to wrap your app with KnownProfilesProvider.'
    );
    return {
      profiles: new Map(),
      getProfile: () => undefined,
      isLoading: false,
      registerExternalDoc: () => {
        console.warn('[useKnownProfiles] Cannot register external doc - no provider found');
      },
    };
  }

  return {
    profiles,
    getProfile,
    isLoading: context.isLoading,
    registerExternalDoc: context.registerExternalDoc,
  };
}
