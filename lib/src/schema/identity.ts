/**
 * Identity types shared across all Narrative apps
 *
 * These types define the DID-based identity system used for authentication
 * and Web of Trust features.
 */

/**
 * User identity (DID-based)
 * Uses real did:key with Ed25519 keypair (format: did:key:z6Mk...)
 */
export interface UserIdentity {
  did: string;          // did:key:z6Mk... (derived from Ed25519 public key)
  displayName?: string;
  avatarUrl?: string;
  publicKey?: string;   // Base64-encoded Ed25519 public key (32 bytes)
}

/**
 * Identity profile stored in document
 * Maps DID → profile information
 */
export interface IdentityProfile {
  displayName?: string;
  avatarUrl?: string;
  publicKey?: string;   // Base64-encoded Ed25519 public key for signature verification
}

/**
 * Trust attestation for Web of Trust
 * Represents a cryptographic assertion that one user trusts another
 */
export interface TrustAttestation {
  id: string;
  trusterDid: string;      // Who is trusting
  trusteeDid: string;      // Who is being trusted
  level: 'verified' | 'endorsed';
  verificationMethod?: 'in-person' | 'video-call' | 'email' | 'social-proof';
  notes?: string;          // Optional: "Met at conference 2025"
  createdAt: number;
  updatedAt: number;

  // Phase 2: Signature (prevents forgery)
  signature?: string;
}

/**
 * Trust level calculated for a user
 */
export type TrustLevel =
  | 'verified'    // Direct attestation from trusted user
  | 'trusted'     // 2nd degree (friend-of-friend)
  | 'endorsed'    // 3rd degree (friend-of-friend-of-friend)
  | 'unknown'     // No trust path
  | 'blocked';    // Explicitly blocked
