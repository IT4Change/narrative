/**
 * useUserDocument - Hook for managing the User Document
 *
 * The User Document is a personal Automerge document that stores:
 * - User profile (name, avatar)
 * - Trust attestations (given and received)
 * - Vouchers (DANK tokens)
 * - Workspace references
 *
 * This hook handles:
 * - Creating or loading the user document based on identity
 * - Providing mutation functions for all user data
 * - Signature verification for received trust attestations
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import type { Repo, DocHandle, DocumentId, AutomergeUrl } from '@automerge/automerge-repo';
import type {
  UserDocument,
  UserProfile,
  WorkspaceRef,
} from '../schema/userDocument';
import {
  createUserDocument,
  addWorkspace as addWorkspaceToDoc,
  removeWorkspace as removeWorkspaceFromDoc,
  touchWorkspace as touchWorkspaceInDoc,
  updateUserProfile as updateUserProfileInDoc,
  addTrustGiven as addTrustGivenToDoc,
  removeTrustGiven as removeTrustGivenFromDoc,
  addTrustReceived as addTrustReceivedToDoc,
  removeTrustReceived as removeTrustReceivedFromDoc,
} from '../schema/userDocument';
import type { TrustAttestation } from '../schema/identity';
import { verifyJws } from '../utils/signature';
import { extractPublicKeyFromDid, base64Encode } from '../utils/did';

// Storage key for user document ID
const USER_DOC_STORAGE_KEY = 'narrative_user_doc_id';

/**
 * Load user document ID from localStorage
 */
export function loadUserDocId(): string | null {
  try {
    return localStorage.getItem(USER_DOC_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Save user document ID to localStorage
 */
export function saveUserDocId(docId: string): void {
  try {
    localStorage.setItem(USER_DOC_STORAGE_KEY, docId);
  } catch {
    console.error('Failed to save user document ID');
  }
}

/**
 * Clear user document ID from localStorage
 */
export function clearUserDocId(): void {
  try {
    localStorage.removeItem(USER_DOC_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export interface UseUserDocumentOptions {
  /** Automerge repository */
  repo: Repo;

  /** Current user's DID */
  did: string;

  /** Display name for new user documents */
  displayName: string;
}

export interface UseUserDocumentResult {
  /** The user document (null while loading) */
  userDoc: UserDocument | null;

  /** Document handle for advanced operations */
  docHandle: DocHandle<UserDocument> | null;

  /** Document ID (Automerge URL) */
  userDocId: string | null;

  /** Whether the document is currently loading */
  isLoading: boolean;

  /** Error message if loading failed */
  error: string | null;

  // Profile operations
  updateProfile: (profile: Partial<UserProfile>) => void;

  // Workspace operations
  addWorkspace: (docId: string, name: string, avatar?: string) => void;
  removeWorkspace: (docId: string) => void;
  touchWorkspace: (docId: string) => void;
  getWorkspaces: () => WorkspaceRef[];

  // Trust operations
  /**
   * Give trust to another user
   * Creates a signed attestation and stores it in trustGiven
   */
  giveTrust: (trusteeDid: string, level: TrustAttestation['level']) => Promise<void>;

  /**
   * Revoke trust from a user
   */
  revokeTrust: (trusteeDid: string) => void;

  /**
   * Write a trust attestation to another user's document
   * This is called after giveTrust to propagate the attestation
   */
  propagateTrustToRecipient: (
    recipientDocHandle: DocHandle<UserDocument>,
    attestation: TrustAttestation
  ) => void;

  /**
   * Get all valid received trust attestations
   * Invalid signatures are filtered out
   */
  getValidReceivedTrust: () => Promise<TrustAttestation[]>;

  /**
   * Get all given trust attestations
   */
  getGivenTrust: () => TrustAttestation[];
}

/**
 * Hook for managing the User Document
 *
 * @example
 * ```tsx
 * const {
 *   userDoc,
 *   updateProfile,
 *   addWorkspace,
 *   giveTrust,
 *   getValidReceivedTrust,
 * } = useUserDocument({
 *   repo,
 *   did: identity.did,
 *   displayName: identity.displayName,
 * });
 * ```
 */
export function useUserDocument(
  options: UseUserDocumentOptions
): UseUserDocumentResult {
  const { repo, did, displayName } = options;

  const [userDocId, setUserDocId] = useState<string | null>(() => loadUserDocId());
  const [docHandle, setDocHandle] = useState<DocHandle<UserDocument> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize or load user document
  useEffect(() => {
    if (!repo || !did) {
      setIsLoading(false);
      return;
    }

    const initDoc = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let handle: DocHandle<UserDocument>;
        let savedDocId = loadUserDocId();

        if (savedDocId) {
          // Try to load existing document
          try {
            // In automerge-repo v2.x, find() returns a Promise that resolves when ready
            handle = await repo.find<UserDocument>(savedDocId as AutomergeUrl);

            // Verify the document belongs to this user
            const doc = handle.doc();
            if (doc && doc.did !== did) {
              console.warn('User document DID mismatch, creating new document');
              savedDocId = null;
            }
          } catch (e) {
            console.warn('Failed to load user document, creating new one', e);
            savedDocId = null;
          }
        }

        if (!savedDocId) {
          // Create new user document
          handle = repo.create<UserDocument>();
          handle.change((d) => {
            const newDoc = createUserDocument(did, displayName);
            Object.assign(d, newDoc);
          });

          const newDocId = handle.url;
          saveUserDocId(newDocId);
          setUserDocId(newDocId);
        } else {
          setUserDocId(savedDocId);
        }

        setDocHandle(handle!);
      } catch (e) {
        console.error('Failed to initialize user document', e);
        setError(e instanceof Error ? e.message : 'Failed to initialize user document');
      } finally {
        setIsLoading(false);
      }
    };

    initDoc();
  }, [repo, did, displayName]);

  // Use the document hook for reactive updates
  const [userDoc] = useDocument<UserDocument>(userDocId as AutomergeUrl | undefined);

  // Profile operations
  const updateProfile = useCallback(
    (profile: Partial<UserProfile>) => {
      if (!docHandle) return;

      docHandle.change((d) => {
        updateUserProfileInDoc(d, profile);
      });
    },
    [docHandle]
  );

  // Workspace operations
  const addWorkspace = useCallback(
    (workspaceDocId: string, name: string, avatar?: string) => {
      if (!docHandle) return;

      docHandle.change((d) => {
        addWorkspaceToDoc(d, workspaceDocId, name, avatar);
      });
    },
    [docHandle]
  );

  const removeWorkspace = useCallback(
    (workspaceDocId: string) => {
      if (!docHandle) return;

      docHandle.change((d) => {
        removeWorkspaceFromDoc(d, workspaceDocId);
      });
    },
    [docHandle]
  );

  const touchWorkspace = useCallback(
    (workspaceDocId: string) => {
      if (!docHandle) return;

      docHandle.change((d) => {
        touchWorkspaceInDoc(d, workspaceDocId);
      });
    },
    [docHandle]
  );

  const getWorkspaces = useCallback((): WorkspaceRef[] => {
    if (!userDoc) return [];
    return Object.values(userDoc.workspaces).sort(
      (a, b) => (b.lastAccessedAt ?? b.addedAt) - (a.lastAccessedAt ?? a.addedAt)
    );
  }, [userDoc]);

  // Trust operations
  const giveTrust = useCallback(
    async (trusteeDid: string, level: TrustAttestation['level']) => {
      if (!docHandle || !did) return;

      // For now, create unsigned attestation
      // TODO: Add signature when we have access to private key
      const attestation: TrustAttestation = {
        id: `trust-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        trusterDid: did,
        trusteeDid: trusteeDid,
        level,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // signature will be added when signing is implemented
      };

      docHandle.change((d) => {
        addTrustGivenToDoc(d, attestation);
      });
    },
    [docHandle, did]
  );

  const revokeTrust = useCallback(
    (trusteeDid: string) => {
      if (!docHandle) return;

      docHandle.change((d) => {
        removeTrustGivenFromDoc(d, trusteeDid);
      });
    },
    [docHandle]
  );

  const propagateTrustToRecipient = useCallback(
    (recipientDocHandle: DocHandle<UserDocument>, attestation: TrustAttestation) => {
      recipientDocHandle.change((d) => {
        addTrustReceivedToDoc(d, attestation);
      });
    },
    []
  );

  const getValidReceivedTrust = useCallback(async (): Promise<TrustAttestation[]> => {
    if (!userDoc) return [];

    const validAttestations: TrustAttestation[] = [];

    for (const attestation of Object.values(userDoc.trustReceived)) {
      // If no signature, skip verification (for backwards compatibility during migration)
      if (!attestation.signature) {
        // TODO: Decide policy - accept unsigned during migration or reject?
        validAttestations.push(attestation);
        continue;
      }

      try {
        // Extract public key from truster's DID
        const publicKeyBytes = extractPublicKeyFromDid(attestation.trusterDid);
        if (!publicKeyBytes) {
          console.warn(`Could not extract public key from DID: ${attestation.trusterDid}`);
          continue;
        }

        // Convert to base64 for verifyJws
        const publicKeyBase64 = base64Encode(publicKeyBytes);

        // Verify signature
        const result = await verifyJws(attestation.signature, publicKeyBase64);
        if (result.valid) {
          validAttestations.push(attestation);
        } else {
          console.warn(`Invalid signature for attestation from ${attestation.trusterDid}: ${result.error}`);
        }
      } catch (e) {
        console.warn(`Failed to verify attestation from ${attestation.trusterDid}`, e);
      }
    }

    return validAttestations;
  }, [userDoc]);

  const getGivenTrust = useCallback((): TrustAttestation[] => {
    if (!userDoc) return [];
    return Object.values(userDoc.trustGiven);
  }, [userDoc]);

  return {
    userDoc: userDoc ?? null,
    docHandle,
    userDocId,
    isLoading,
    error,
    updateProfile,
    addWorkspace,
    removeWorkspace,
    touchWorkspace,
    getWorkspaces,
    giveTrust,
    revokeTrust,
    propagateTrustToRecipient,
    getValidReceivedTrust,
    getGivenTrust,
  };
}