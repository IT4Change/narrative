/**
 * useAppContext - Centralized hook for app-wide state management
 *
 * Manages:
 * - Identity (loading, saving, updating)
 * - Workspaces (list, switching, creating)
 * - Hidden users
 * - Trust attestations + notifications
 * - Toast notifications
 * - All standard modal props (TrustReciprocityModal, NewWorkspaceModal, Toast)
 *
 * Apps should use this hook and simply spread the provided props to components.
 * No manual state management or handlers needed for standard functionality.
 */

import { useState, useEffect, useCallback } from 'react';
import type { DocHandle } from '@automerge/automerge-repo';
import {
  loadSharedIdentity,
  saveSharedIdentity,
  type StoredIdentity,
} from '../utils/storage';
import {
  loadWorkspaceList,
  saveWorkspaceList,
  upsertWorkspace,
  type WorkspaceInfo,
} from '../components/WorkspaceSwitcher';
import { addTrustAttestation } from '../schema';
import type { BaseDocument } from '../schema/document';
import type { TrustAttestation } from '../schema/identity';

// Storage key for seen trust attestations
const TRUST_STORAGE_KEY = 'narrativeTrustNotifications';

interface SeenAttestations {
  [documentId: string]: string[];
}

function getSeenAttestations(documentId: string): Set<string> {
  try {
    const stored = localStorage.getItem(TRUST_STORAGE_KEY);
    if (!stored) return new Set();
    const data: SeenAttestations = JSON.parse(stored);
    return new Set(data[documentId] || []);
  } catch {
    return new Set();
  }
}

function markAttestationsAsSeen(documentId: string, attestationIds: string[]): void {
  try {
    const stored = localStorage.getItem(TRUST_STORAGE_KEY);
    const data: SeenAttestations = stored ? JSON.parse(stored) : {};
    if (!data[documentId]) {
      data[documentId] = [];
    }
    const currentSet = new Set(data[documentId]);
    attestationIds.forEach(id => currentSet.add(id));
    data[documentId] = Array.from(currentSet);
    localStorage.setItem(TRUST_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export interface UseAppContextOptions<TData = unknown> {
  /** The Automerge document */
  doc: BaseDocument<TData> | null | undefined;

  /** The Automerge document handle for mutations */
  docHandle: DocHandle<BaseDocument<TData>> | null | undefined;

  /** Document ID as string (for workspace tracking and trust notifications) */
  documentId: string;

  /** Current user's DID (required for trust features) */
  currentUserDid?: string;

  /** App title shown in navbar (when workspace switcher is hidden) */
  appTitle?: string;

  /** Workspace name for this document */
  workspaceName?: string;

  /** Whether to hide the workspace switcher (simple single-doc apps) */
  hideWorkspaceSwitcher?: boolean;

  /** Logo URL for workspace switcher */
  logoUrl?: string;

  /** Callback when identity needs to be reset */
  onResetIdentity?: () => void;

  /**
   * Callback when a new workspace is created via the modal.
   * If provided, the modal will be available and this will be called with the name and optional avatar.
   */
  onCreateWorkspace?: (name: string, avatarDataUrl?: string) => void;

  /** Callback to update identity in the document (app-specific) */
  onUpdateIdentityInDoc?: (updates: { displayName?: string; avatarUrl?: string }) => void;
}

export interface AppContextValue<TData = unknown> {
  // Identity
  identity: StoredIdentity | null;
  currentUserDid: string;

  // Workspaces
  workspaces: WorkspaceInfo[];
  currentWorkspace: WorkspaceInfo | null;

  // UI State
  hiddenUserDids: Set<string>;
  toastMessage: string | null;
  isNewWorkspaceModalOpen: boolean;

  // Trust notifications
  pendingAttestations: TrustAttestation[];
  hasPendingTrust: boolean;

  // Handlers
  handleSwitchWorkspace: (workspaceId: string) => void;
  handleNewWorkspace: () => void;
  handleUpdateIdentity: (updates: { displayName?: string; avatarUrl?: string }) => void;
  handleTrustUser: (trusteeDid: string) => void;
  handleTrustBack: (trusterDid: string) => void;
  handleDeclineTrust: (attestationId: string) => void;
  handleResetIdentity: () => void;
  toggleUserVisibility: (did: string) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  openNewWorkspaceModal: () => void;
  closeNewWorkspaceModal: () => void;
  handleCreateWorkspace: (name: string, avatarDataUrl?: string) => void;

  // Props ready for components - just spread these!
  navbarProps: {
    currentUserDid: string;
    doc: BaseDocument<TData>;
    logoUrl: string;
    currentWorkspace: WorkspaceInfo | null;
    workspaces: WorkspaceInfo[];
    onSwitchWorkspace: (workspaceId: string) => void;
    onNewWorkspace: () => void;
    onUpdateIdentity: (updates: { displayName?: string; avatarUrl?: string }) => void;
    onTrustUser: (trusteeDid: string) => void;
    onResetIdentity: () => void;
    onToggleUserVisibility: (did: string) => void;
    hiddenUserDids: Set<string>;
    initialDisplayName?: string;
    onShowToast: (message: string) => void;
    hideWorkspaceSwitcher?: boolean;
    appTitle?: string;
  } | null;

  newWorkspaceModalProps: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, avatarDataUrl?: string) => void;
  };

  trustReciprocityModalProps: {
    pendingAttestations: TrustAttestation[];
    doc: BaseDocument<TData>;
    currentUserDid: string;
    onTrustBack: (trusterDid: string) => void;
    onDecline: (attestationId: string) => void;
    onShowToast: (message: string) => void;
  } | null;

  toastProps: {
    message: string;
    type: 'success';
    onClose: () => void;
  } | null;
}

export function useAppContext<TData = unknown>(
  options: UseAppContextOptions<TData>
): AppContextValue<TData> {
  const {
    doc,
    docHandle,
    documentId,
    currentUserDid: providedUserDid,
    appTitle,
    workspaceName = 'Workspace',
    hideWorkspaceSwitcher = false,
    logoUrl = '/logo.svg',
    onResetIdentity,
    onCreateWorkspace,
    onUpdateIdentityInDoc,
  } = options;

  // Identity state
  const [identity, setIdentity] = useState<StoredIdentity | null>(() => loadSharedIdentity());

  // Workspace state
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>(() => loadWorkspaceList());

  // UI state
  const [hiddenUserDids, setHiddenUserDids] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);

  // Trust notifications state
  const [pendingAttestations, setPendingAttestations] = useState<TrustAttestation[]>([]);

  // Current user DID - prefer provided, fallback to identity
  const currentUserDid = providedUserDid ?? identity?.did ?? '';

  // Get workspace name and avatar from document context (prefer doc.context over props)
  const docContext = (doc as BaseDocument<TData> | null)?.context;
  const effectiveWorkspaceName = docContext?.name || workspaceName;
  const workspaceAvatar = docContext?.avatar;

  // Track current workspace in list
  useEffect(() => {
    if (!doc || !documentId) return;

    const workspaceInfo: WorkspaceInfo = {
      id: documentId,
      name: effectiveWorkspaceName,
      lastAccessed: Date.now(),
      ...(workspaceAvatar && { avatar: workspaceAvatar }),
    };

    setWorkspaces((prev) => {
      const updated = upsertWorkspace(prev, workspaceInfo);
      saveWorkspaceList(updated);
      return updated;
    });
  }, [documentId, doc, effectiveWorkspaceName, workspaceAvatar]);

  // Trust notifications detection
  useEffect(() => {
    if (!doc || !currentUserDid || !documentId) {
      setPendingAttestations([]);
      return;
    }

    const seenIds = getSeenAttestations(documentId);

    // Find attestations where current user is the trustee
    const incomingAttestations = Object.values(doc.trustAttestations || {}).filter(
      (attestation) => attestation.trusteeDid === currentUserDid
    );

    // Filter out seen attestations and self-attestations
    const newAttestations = incomingAttestations.filter(
      (attestation) =>
        !seenIds.has(attestation.id) &&
        attestation.trusterDid !== currentUserDid
    );

    // Sort by creation time (oldest first)
    newAttestations.sort((a, b) => a.createdAt - b.createdAt);

    setPendingAttestations(newAttestations);
  }, [doc, doc?.trustAttestations, currentUserDid, documentId]);

  // Current workspace info
  const currentWorkspace: WorkspaceInfo | null = doc
    ? {
        id: documentId,
        name: effectiveWorkspaceName,
        lastAccessed: Date.now(),
        ...(workspaceAvatar && { avatar: workspaceAvatar }),
      }
    : null;

  // Handlers
  const handleSwitchWorkspace = useCallback((workspaceId: string) => {
    window.location.hash = `#doc=${workspaceId}`;
    window.location.reload();
  }, []);

  const openNewWorkspaceModal = useCallback(() => {
    setIsNewWorkspaceModalOpen(true);
  }, []);

  const closeNewWorkspaceModal = useCallback(() => {
    setIsNewWorkspaceModalOpen(false);
  }, []);

  const handleNewWorkspace = useCallback(() => {
    openNewWorkspaceModal();
  }, [openNewWorkspaceModal]);

  const handleUpdateIdentity = useCallback(
    (updates: { displayName?: string; avatarUrl?: string }) => {
      if (!identity || !docHandle) return;

      // Update local identity
      const updatedIdentity = { ...identity, ...updates };
      setIdentity(updatedIdentity);
      saveSharedIdentity(updatedIdentity);

      // Update in document (app-specific or generic)
      if (onUpdateIdentityInDoc) {
        onUpdateIdentityInDoc(updates);
      } else {
        // Generic update
        docHandle.change((d: BaseDocument<TData>) => {
          if (!d.identities[identity.did]) {
            d.identities[identity.did] = {};
          }
          if (updates.displayName !== undefined) {
            d.identities[identity.did].displayName = updates.displayName;
          }
          if (updates.avatarUrl !== undefined) {
            d.identities[identity.did].avatarUrl = updates.avatarUrl;
          }
          d.lastModified = Date.now();
        });
      }
    },
    [identity, docHandle, onUpdateIdentityInDoc]
  );

  const handleTrustUser = useCallback(
    (trusteeDid: string) => {
      if (!docHandle || !currentUserDid) return;

      docHandle.change((d: BaseDocument<TData>) => {
        addTrustAttestation(d, currentUserDid, trusteeDid, 'verified', 'in-person');
        d.lastModified = Date.now();
      });
    },
    [docHandle, currentUserDid]
  );

  const handleTrustBack = useCallback(
    (trusterDid: string) => {
      if (!docHandle || !currentUserDid || !documentId) return;

      docHandle.change((d: BaseDocument<TData>) => {
        addTrustAttestation(d, currentUserDid, trusterDid, 'verified', 'in-person');
        d.lastModified = Date.now();
      });

      // Mark the corresponding attestation as seen
      const attestation = pendingAttestations.find(att => att.trusterDid === trusterDid);
      if (attestation) {
        markAttestationsAsSeen(documentId, [attestation.id]);
        setPendingAttestations(prev => prev.filter(att => att.id !== attestation.id));
      }
    },
    [docHandle, currentUserDid, documentId, pendingAttestations]
  );

  const handleDeclineTrust = useCallback(
    (attestationId: string) => {
      if (!documentId) return;

      markAttestationsAsSeen(documentId, [attestationId]);
      setPendingAttestations(prev => prev.filter(att => att.id !== attestationId));
    },
    [documentId]
  );

  const handleResetIdentity = useCallback(() => {
    if (onResetIdentity) {
      onResetIdentity();
    } else {
      localStorage.removeItem('narrative_shared_identity');
      window.location.reload();
    }
  }, [onResetIdentity]);

  const toggleUserVisibility = useCallback((did: string) => {
    setHiddenUserDids((prev) => {
      const next = new Set(prev);
      if (next.has(did)) {
        next.delete(did);
      } else {
        next.add(did);
      }
      return next;
    });
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const handleCreateWorkspace = useCallback(
    (name: string, avatarDataUrl?: string) => {
      if (onCreateWorkspace) {
        onCreateWorkspace(name, avatarDataUrl);
      }
      closeNewWorkspaceModal();
    },
    [onCreateWorkspace, closeNewWorkspaceModal]
  );

  // Props ready for NewWorkspaceModal
  const newWorkspaceModalProps = {
    isOpen: isNewWorkspaceModalOpen,
    onClose: closeNewWorkspaceModal,
    onCreate: handleCreateWorkspace,
  };

  // Props ready for TrustReciprocityModal
  const trustReciprocityModalProps = doc
    ? {
        pendingAttestations,
        doc: doc as BaseDocument<TData>,
        currentUserDid,
        onTrustBack: handleTrustBack,
        onDecline: handleDeclineTrust,
        onShowToast: showToast,
      }
    : null;

  // Props ready for Toast
  const toastProps = toastMessage
    ? {
        message: toastMessage,
        type: 'success' as const,
        onClose: clearToast,
      }
    : null;

  // Build navbar props (only if doc is loaded)
  const navbarProps = doc
    ? {
        currentUserDid,
        doc: doc as BaseDocument<TData>,
        logoUrl,
        currentWorkspace,
        workspaces,
        onSwitchWorkspace: handleSwitchWorkspace,
        onNewWorkspace: handleNewWorkspace,
        onUpdateIdentity: handleUpdateIdentity,
        onTrustUser: handleTrustUser,
        onResetIdentity: handleResetIdentity,
        onToggleUserVisibility: toggleUserVisibility,
        hiddenUserDids,
        initialDisplayName: identity?.displayName,
        onShowToast: showToast,
        hideWorkspaceSwitcher,
        appTitle,
      }
    : null;

  return {
    identity,
    currentUserDid,
    workspaces,
    currentWorkspace,
    hiddenUserDids,
    toastMessage,
    isNewWorkspaceModalOpen,
    pendingAttestations,
    hasPendingTrust: pendingAttestations.length > 0,
    handleSwitchWorkspace,
    handleNewWorkspace,
    handleUpdateIdentity,
    handleTrustUser,
    handleTrustBack,
    handleDeclineTrust,
    handleResetIdentity,
    toggleUserVisibility,
    showToast,
    clearToast,
    openNewWorkspaceModal,
    closeNewWorkspaceModal,
    handleCreateWorkspace,
    navbarProps,
    newWorkspaceModalProps,
    trustReciprocityModalProps,
    toastProps,
  };
}
