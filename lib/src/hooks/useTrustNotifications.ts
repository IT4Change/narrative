import { useEffect, useState } from 'react';
import type { BaseDocument } from '../schema/document';
import type { TrustAttestation } from '../schema/identity';

const STORAGE_KEY = 'narrativeTrustNotifications';

interface SeenAttestations {
  [documentId: string]: string[]; // documentId -> attestation IDs
}

/**
 * Get seen attestation IDs for a document from localStorage
 */
function getSeenAttestations(documentId: string): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set();

    const data: SeenAttestations = JSON.parse(stored);
    return new Set(data[documentId] || []);
  } catch (error) {
    console.error('Failed to load seen attestations:', error);
    return new Set();
  }
}

/**
 * Mark attestation IDs as seen in localStorage
 */
function markAttestationsAsSeen(documentId: string, attestationIds: string[]): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const data: SeenAttestations = stored ? JSON.parse(stored) : {};

    if (!data[documentId]) {
      data[documentId] = [];
    }

    // Add new IDs, avoiding duplicates
    const currentSet = new Set(data[documentId]);
    attestationIds.forEach(id => currentSet.add(id));
    data[documentId] = Array.from(currentSet);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save seen attestations:', error);
  }
}

/**
 * Hook to detect new trust attestations where the current user is the trustee
 *
 * Returns pending attestations that haven't been seen yet, in chronological order.
 * Provides methods to mark attestations as seen.
 *
 * @param doc - The Automerge document
 * @param currentUserDid - The current user's DID
 * @param documentId - The document ID (for localStorage key)
 */
export function useTrustNotifications<TData = unknown>(
  doc: BaseDocument<TData> | undefined,
  currentUserDid: string,
  documentId: string
) {
  const [pendingAttestations, setPendingAttestations] = useState<TrustAttestation[]>([]);

  useEffect(() => {
    if (!doc || !currentUserDid) {
      setPendingAttestations([]);
      return;
    }

    // Get seen attestations from localStorage
    const seenIds = getSeenAttestations(documentId);

    // Find attestations where current user is the trustee
    const incomingAttestations = Object.values(doc.trustAttestations).filter(
      (attestation) => attestation.trusteeDid === currentUserDid
    );

    // Find DIDs that the current user already trusts
    const alreadyTrustedDids = new Set(
      Object.values(doc.trustAttestations)
        .filter((att) => att.trusterDid === currentUserDid)
        .map((att) => att.trusteeDid)
    );

    // Filter out seen attestations, self-attestations, and users we already trust
    const newAttestations = incomingAttestations.filter(
      (attestation) =>
        !seenIds.has(attestation.id) &&
        attestation.trusterDid !== currentUserDid &&
        !alreadyTrustedDids.has(attestation.trusterDid)
    );

    // Sort by creation time (oldest first)
    newAttestations.sort((a, b) => a.createdAt - b.createdAt);

    setPendingAttestations(newAttestations);
  }, [doc, doc?.trustAttestations, currentUserDid, documentId]);

  /**
   * Mark an attestation as seen
   */
  const markAsSeen = (attestationId: string) => {
    markAttestationsAsSeen(documentId, [attestationId]);
    setPendingAttestations(prev => prev.filter(att => att.id !== attestationId));
  };

  /**
   * Mark multiple attestations as seen
   */
  const markMultipleAsSeen = (attestationIds: string[]) => {
    markAttestationsAsSeen(documentId, attestationIds);
    setPendingAttestations(prev =>
      prev.filter(att => !attestationIds.includes(att.id))
    );
  };

  return {
    pendingAttestations,
    hasPending: pendingAttestations.length > 0,
    markAsSeen,
    markMultipleAsSeen,
  };
}
