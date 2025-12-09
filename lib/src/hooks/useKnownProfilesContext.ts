/**
 * useKnownProfilesContext - Hook to consume the KnownProfiles context
 *
 * Must be used within a KnownProfilesProvider.
 */

import { useContext } from 'react';
import { KnownProfilesContext } from '../providers/KnownProfilesProvider';
import type { KnownProfilesContextValue } from '../providers/types';

/**
 * Hook to consume the KnownProfiles context.
 *
 * @throws Error if used outside of KnownProfilesProvider
 * @returns The context value with profiles, getProfile, isLoading, and registerExternalDoc
 */
export function useKnownProfilesContext(): KnownProfilesContextValue {
  const context = useContext(KnownProfilesContext);

  if (!context) {
    throw new Error(
      'useKnownProfilesContext must be used within a KnownProfilesProvider. ' +
      'Make sure KnownProfilesProvider is an ancestor of this component.'
    );
  }

  return context;
}

/**
 * Optional version that returns null instead of throwing if used outside provider.
 * Useful for conditional rendering or optional features.
 */
export function useKnownProfilesContextOptional(): KnownProfilesContextValue | null {
  return useContext(KnownProfilesContext);
}
