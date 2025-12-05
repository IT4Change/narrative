/**
 * AppShell - Generic application shell for Narrative apps
 *
 * Handles:
 * - Automerge repo initialization
 * - Document creation/loading (URL hash + localStorage)
 * - Identity management (DID generation + localStorage)
 * - Fake DID migration
 * - Optional: User Document initialization (personal cross-workspace data)
 */

import { useEffect, useState, type ReactNode } from 'react';
import type { Repo, DocHandle, AutomergeUrl } from '@automerge/automerge-repo';
import { RepoContext } from '@automerge/automerge-repo-react-hooks';
import type { DocumentId } from '@automerge/automerge-repo';
import { generateDidIdentity, isFakeDid } from '../utils/did';
import type { UserIdentity } from '../schema/identity';
import type { UserDocument } from '../schema/userDocument';
import { createUserDocument } from '../schema/userDocument';
import {
  loadSharedIdentity,
  saveSharedIdentity,
  clearSharedIdentity,
  loadDocumentId,
  saveDocumentId,
  clearDocumentId,
} from '../utils/storage';
import {
  loadUserDocId,
  saveUserDocId,
  clearUserDocId,
} from '../hooks/useUserDocument';
import { LoadingScreen } from './LoadingScreen';

export interface AppShellChildProps {
  documentId: DocumentId;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetIdentity: () => void;
  onNewDocument: (name?: string, avatarDataUrl?: string) => void;

  // User Document (optional, only if enableUserDocument is true)
  userDocId?: string;
  userDocHandle?: DocHandle<UserDocument>;
}

export interface AppShellProps<TDoc> {
  /**
   * Automerge repo instance
   * (can be created by useRepository hook or passed directly)
   */
  repo: Repo;

  /**
   * Factory function to create empty document with user identity
   * @param identity - User identity
   * @param workspaceName - Optional workspace name
   * @param workspaceAvatar - Optional workspace avatar (data URL)
   */
  createEmptyDocument: (identity: UserIdentity, workspaceName?: string, workspaceAvatar?: string) => TDoc;

  /**
   * localStorage key prefix for this app (e.g., 'narrative', 'mapapp')
   * Used for storing document ID: `${storagePrefix}_docId`
   */
  storagePrefix: string;

  /**
   * Enable User Document for cross-workspace personal data
   * When true, AppShell will also initialize/load the user's personal document
   * @default false
   */
  enableUserDocument?: boolean;

  /**
   * Render function that receives initialized document and identity
   */
  children: (props: AppShellChildProps) => ReactNode;
}

/**
 * Generic app shell that handles document and identity initialization
 *
 * @example
 * ```tsx
 * <AppShell
 *   repo={repo}
 *   createEmptyDocument={createEmptyOpinionGraphDoc}
 *   storagePrefix="narrative"
 * >
 *   {(props) => <MainView {...props} />}
 * </AppShell>
 * ```
 */
export function AppShell<TDoc>({
  repo,
  createEmptyDocument,
  storagePrefix,
  enableUserDocument = false,
  children,
}: AppShellProps<TDoc>) {
  const [documentId, setDocumentId] = useState<DocumentId | null>(null);
  const [currentUserDid, setCurrentUserDid] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | undefined>(undefined);
  const [publicKey, setPublicKey] = useState<string | undefined>(undefined);
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);
  const [isInitializing, setIsInitializing] = useState(true);

  // User Document state (optional)
  const [userDocId, setUserDocId] = useState<string | undefined>(undefined);
  const [userDocHandle, setUserDocHandle] = useState<DocHandle<UserDocument> | undefined>(undefined);

  // Initialize document and identity on mount
  useEffect(() => {
    initializeDocument();
  }, []);

  // Listen to URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const newDocId = params.get('doc');
      if (newDocId && newDocId !== documentId) {
        setDocumentId(newDocId as DocumentId);
        saveDocumentId(storagePrefix, newDocId);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [documentId, storagePrefix]);

  /**
   * Initialize or load the User Document
   * This is a personal document that syncs across workspaces
   */
  const initializeUserDocument = async (identity: { did: string; displayName?: string }) => {
    const savedUserDocId = loadUserDocId();

    let handle: DocHandle<UserDocument>;

    if (savedUserDocId) {
      // Try to load existing user document
      try {
        handle = repo.find<UserDocument>(savedUserDocId as AutomergeUrl);
        await handle.whenReady();

        // Verify the document belongs to this user
        const doc = handle.docSync();
        if (doc && doc.did !== identity.did) {
          console.warn('User document DID mismatch, creating new document');
          // Create new document instead
          handle = repo.create<UserDocument>();
          handle.change((d) => {
            const newDoc = createUserDocument(identity.did, identity.displayName || 'User');
            Object.assign(d, newDoc);
          });
          saveUserDocId(handle.url);
        }
      } catch (e) {
        console.warn('Failed to load user document, creating new one', e);
        // Create new document
        handle = repo.create<UserDocument>();
        handle.change((d) => {
          const newDoc = createUserDocument(identity.did, identity.displayName || 'User');
          Object.assign(d, newDoc);
        });
        saveUserDocId(handle.url);
      }
    } else {
      // Create new user document
      handle = repo.create<UserDocument>();
      handle.change((d) => {
        const newDoc = createUserDocument(identity.did, identity.displayName || 'User');
        Object.assign(d, newDoc);
      });
      saveUserDocId(handle.url);
    }

    setUserDocId(handle.url);
    setUserDocHandle(handle);
  };

  const initializeDocument = async () => {
    // Check URL for shared document ID (e.g., #doc=automerge:...)
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const urlDocId = urlParams.get('doc');

    // Try to load existing document from URL, then localStorage
    const savedDocId = loadDocumentId(storagePrefix);
    const savedIdentity = loadSharedIdentity();

    // Migration: Check for fake DIDs and reset
    if (savedIdentity && isFakeDid(savedIdentity.did)) {
      console.warn('Detected fake DID. Upgrading to real DIDs. Clearing localStorage...');
      clearSharedIdentity();
      clearDocumentId(storagePrefix);
      alert('Upgraded to secure DIDs. Your identity has been reset. Please create a new board.');
      window.location.hash = '';
      window.location.reload();
      return;
    }

    // Each browser needs its own identity
    let identity = savedIdentity;
    if (!identity) {
      // Generate real DID with Ed25519 keypair
      const didIdentity = await generateDidIdentity(
        `User-${Math.random().toString(36).substring(7)}`
      );
      identity = {
        did: didIdentity.did,
        displayName: didIdentity.displayName,
        publicKey: didIdentity.publicKey,
        privateKey: didIdentity.privateKey, // Store for future signing
      };
      saveSharedIdentity(identity);
    }

    setCurrentUserDid(identity.did);
    setPrivateKey(identity.privateKey); // Set private key for signing
    setPublicKey(identity.publicKey); // Set public key for identity verification
    setDisplayName(identity.displayName); // Set display name for identity

    // Initialize User Document if enabled
    if (enableUserDocument) {
      await initializeUserDocument(identity);
    }

    const docIdToUse = urlDocId || savedDocId;

    if (docIdToUse) {
      // Load existing document (from URL or localStorage)
      setDocumentId(docIdToUse as DocumentId);
      saveDocumentId(storagePrefix, docIdToUse);

      // Update URL if not already there
      if (!urlDocId) {
        window.location.hash = `doc=${docIdToUse}`;
      }

      // IMPORTANT: Wait for document to be available before finishing init
      // This ensures the document is loaded from IndexedDB before rendering
      const handle = repo.find(docIdToUse as DocumentId);

      // Wait for document to be ready
      await handle.whenReady();

      setIsInitializing(false);
    } else {
      // Create new document with current user's identity
      const handle = repo.create(createEmptyDocument(identity));
      const docId = handle.documentId;

      // Save document ID and add to URL
      saveDocumentId(storagePrefix, docId);
      window.location.hash = `doc=${docId}`;

      setDocumentId(docId);
      setIsInitializing(false);
    }
  };

  const handleResetIdentity = () => {
    clearSharedIdentity();
    if (enableUserDocument) {
      clearUserDocId();
    }
    window.location.reload();
  };

  const handleNewDocument = async (workspaceName?: string, workspaceAvatar?: string) => {
    const storedIdentity = loadSharedIdentity();
    let identity = storedIdentity;

    if (!identity) {
      // Generate new identity if none exists (shouldn't happen, but safe fallback)
      const didIdentity = await generateDidIdentity(
        `User-${Math.random().toString(36).substring(7)}`
      );
      identity = {
        did: didIdentity.did,
        displayName: didIdentity.displayName,
        publicKey: didIdentity.publicKey,
        privateKey: didIdentity.privateKey,
      };
      saveSharedIdentity(identity);
    }

    const handle = repo.create(createEmptyDocument(identity, workspaceName, workspaceAvatar));
    const docId = handle.documentId;
    saveDocumentId(storagePrefix, docId);

    // Push new hash so back button returns to previous board
    const url = new URL(window.location.href);
    url.hash = `doc=${docId}`;
    window.history.pushState(null, '', url.toString());
    setDocumentId(docId);
  };

  // Show loading while initializing
  if (isInitializing || !documentId || !currentUserDid) {
    return <LoadingScreen />;
  }

  return (
    <RepoContext.Provider value={repo}>
      {children({
        documentId,
        currentUserDid,
        privateKey,
        publicKey,
        displayName,
        onResetIdentity: handleResetIdentity,
        onNewDocument: handleNewDocument,
        // User Document (only if enabled)
        ...(enableUserDocument && {
          userDocId,
          userDocHandle,
        }),
      })}
    </RepoContext.Provider>
  );
}
