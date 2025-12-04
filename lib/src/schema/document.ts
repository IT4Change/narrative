/**
 * Generic document structure shared by all Narrative apps
 *
 * This provides a common wrapper around app-specific data, ensuring all apps
 * have access to shared identity and trust infrastructure.
 */

import type { IdentityProfile, TrustAttestation, UserIdentity } from './identity';

/**
 * Base document structure shared by all Narrative apps
 * Wraps app-specific data with shared identity & trust infrastructure
 *
 * @template TData - App-specific data type (e.g., OpinionGraphData, MapData)
 */
export interface BaseDocument<TData = unknown> {
  // Metadata
  version: string;
  lastModified: number;

  // Identity (shared across all apps)
  identities: Record<string, IdentityProfile>;  // DID → profile

  // Web of Trust (shared across all apps)
  trustAttestations: Record<string, TrustAttestation>;

  // App-specific data
  data: TData;
}

/**
 * Create empty base document with creator identity
 *
 * @param initialData - App-specific initial data
 * @param creatorIdentity - Identity of the user creating the document
 * @returns BaseDocument with initialized identity and empty trust attestations
 */
export function createBaseDocument<TData>(
  initialData: TData,
  creatorIdentity: UserIdentity
): BaseDocument<TData> {
  // Build identity profile from creator identity
  const profile: IdentityProfile = {};
  if (creatorIdentity.displayName !== undefined) {
    profile.displayName = creatorIdentity.displayName;
  }
  if (creatorIdentity.avatarUrl !== undefined) {
    profile.avatarUrl = creatorIdentity.avatarUrl;
  }
  if (creatorIdentity.publicKey !== undefined) {
    profile.publicKey = creatorIdentity.publicKey;
  }

  return {
    version: '1.0.0',
    lastModified: Date.now(),
    identities: {
      [creatorIdentity.did]: profile,
    },
    trustAttestations: {},
    data: initialData,
  };
}
