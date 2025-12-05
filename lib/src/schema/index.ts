/**
 * Narrative schema exports
 *
 * This module re-exports all schema types and utilities.
 * Organized into modular files for better maintainability.
 */

// Identity types (shared across all apps)
export type {
  UserIdentity,
  IdentityProfile,
  TrustAttestation,
  TrustLevel,
} from './identity';

// Generic document structure (shared across all apps)
// Note: Trust attestations moved to UserDocument
export type { BaseDocument, ContextMetadata, IdentityLookupEntry } from './document';
export {
  createBaseDocument,
  generateId,
} from './document';

// User Document (personal, cross-workspace data)
export type {
  UserDocument,
  UserProfile,
  Voucher,
  WorkspaceRef,
} from './userDocument';
export {
  createUserDocument,
  addWorkspace,
  removeWorkspace,
  touchWorkspace,
  updateUserProfile,
  addTrustGiven,
  removeTrustGiven,
  addTrustReceived,
  removeTrustReceived,
} from './userDocument';
