/**
 * Map Data schema - domain-specific for Map app
 *
 * This schema defines the data structure for tracking user locations
 * on a geographic map.
 */

import type { BaseDocument, UserIdentity } from 'narrative-ui';
import { createBaseDocument } from 'narrative-ui';

/**
 * User location on the map
 */
export interface UserLocation {
  id: string;
  userDid: string; // DID of the user
  lat: number; // Latitude
  lng: number; // Longitude
  label?: string; // Optional label/description
  createdAt: number;
  updatedAt: number;

  // Phase 2: Cryptographic signatures
  signature?: string;
}

/**
 * Map-specific data structure
 */
export interface MapData {
  locations: Record<string, UserLocation>; // Normalized by ID

  // Metadata
  createdBy?: string; // DID of map creator
  identity?: UserIdentity; // Legacy, for backward compatibility
}

/**
 * Complete Map document type
 */
export type MapDoc = BaseDocument<MapData>;

/**
 * Generate a unique ID for entities
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an empty map document
 * @param creatorIdentity - Identity of the user creating the document
 * @param workspaceName - Optional workspace name
 * @param workspaceAvatar - Optional workspace avatar (data URL)
 * @returns MapDoc with empty collections
 */
export function createEmptyMapDoc(
  creatorIdentity: UserIdentity,
  workspaceName?: string,
  workspaceAvatar?: string
): MapDoc {
  return createBaseDocument<MapData>(
    {
      locations: {},
      createdBy: creatorIdentity.did,
    },
    creatorIdentity,
    workspaceName,
    workspaceAvatar
  );
}
