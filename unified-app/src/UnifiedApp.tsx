/**
 * UnifiedApp - Main application with module switching
 *
 * Handles:
 * - Document creation/loading from URL hash
 * - Identity management (DID generation, localStorage)
 * - Module switching UI
 * - Shared infrastructure via AppLayout
 */

import { useEffect, useState, useCallback } from 'react';
import { useRepo, useDocument } from '@automerge/automerge-repo-react-hooks';
import type { DocumentId, DocHandle } from '@automerge/automerge-repo';
import {
  generateDidIdentity,
  loadSharedIdentity,
  saveSharedIdentity,
  loadDocumentId,
  saveDocumentId,
  AppLayout,
  type AppContextValue,
} from 'narrative-ui';
import type { UserIdentity } from 'narrative-ui';
import { UnifiedDocument, createEmptyUnifiedDoc, AVAILABLE_MODULES, ModuleId } from './types';
import { ModuleSwitcher } from './components/ModuleSwitcher';
import { NarrativeModuleWrapper } from './components/NarrativeModuleWrapper';
import { MarketModuleWrapper } from './components/MarketModuleWrapper';
import { MapModuleWrapper } from './components/MapModuleWrapper';

/**
 * Main Unified Application Component
 */
export function UnifiedApp() {
  const repo = useRepo();

  // Identity state
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [isLoadingIdentity, setIsLoadingIdentity] = useState(true);

  // Document state
  const [documentId, setDocumentId] = useState<DocumentId | null>(null);
  const [docHandle, setDocHandle] = useState<DocHandle<UnifiedDocument> | null>(null);

  // App-specific UI state
  const [activeModule, setActiveModule] = useState<ModuleId>('narrative');
  const [loadTimeout, setLoadTimeout] = useState(false);

  // Document from Automerge
  const [doc] = useDocument<UnifiedDocument>(documentId ?? undefined);

  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;

  // Initialize identity on mount
  useEffect(() => {
    async function initIdentity() {
      setIsLoadingIdentity(true);

      // Try to load existing identity
      const savedIdentity = loadSharedIdentity();
      if (savedIdentity) {
        setIdentity(savedIdentity);
        setIsLoadingIdentity(false);
        return;
      }

      // Generate new identity
      const newIdentity = await generateDidIdentity();
      saveSharedIdentity(newIdentity);
      setIdentity(newIdentity);
      setIsLoadingIdentity(false);
    }

    initIdentity();
  }, []);

  // Initialize document from URL hash or localStorage
  useEffect(() => {
    if (!identity || !repo) return;

    // Check URL hash first
    const hash = window.location.hash;
    const match = hash.match(/#doc=(.+)/);

    if (match) {
      const docId = match[1] as DocumentId;
      setDocumentId(docId);
      saveDocumentId('unifiedDocId', docId);
      const handle = repo.find<UnifiedDocument>(docId);
      setDocHandle(handle);
      return;
    }

    // Check localStorage
    const savedDocIdStr = loadDocumentId('unifiedDocId');
    if (savedDocIdStr) {
      const savedDocId = savedDocIdStr as DocumentId;
      setDocumentId(savedDocId);
      window.location.hash = `doc=${savedDocId}`;
      const handle = repo.find<UnifiedDocument>(savedDocId);
      setDocHandle(handle);
      return;
    }

    // Create new document
    const newDoc = createEmptyUnifiedDoc(identity);
    const handle = repo.create<UnifiedDocument>(newDoc);
    const newDocId = handle.documentId;
    setDocumentId(newDocId);
    setDocHandle(handle);
    saveDocumentId('unifiedDocId', newDocId);
    window.location.hash = `doc=${newDocId}`;
  }, [identity, repo]);

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/#doc=(.+)/);
      if (match && match[1] !== documentId) {
        const newDocId = match[1] as DocumentId;
        setDocumentId(newDocId);
        saveDocumentId('unifiedDocId', newDocId);
        if (repo) {
          const handle = repo.find<UnifiedDocument>(newDocId);
          setDocHandle(handle);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [documentId, repo]);

  // Loading timeout - show reset option after 10 seconds
  useEffect(() => {
    if (doc || !documentId) {
      setLoadTimeout(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoadTimeout(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, [doc, documentId]);

  // Custom workspace creation for unified-app (creates UnifiedDocument with context)
  const handleCreateWorkspace = useCallback(
    (name: string, avatarDataUrl?: string) => {
      if (!identity || !repo) return;

      const newDoc = createEmptyUnifiedDoc(identity);
      newDoc.context = { name, avatar: avatarDataUrl };

      const handle = repo.create<UnifiedDocument>(newDoc);
      const newDocId = handle.documentId;
      setDocumentId(newDocId);
      setDocHandle(handle);
      saveDocumentId('unifiedDocId', newDocId);
      window.location.hash = `doc=${newDocId}`;
    },
    [identity, repo]
  );

  const handleResetIdentity = useCallback(() => {
    localStorage.removeItem('narrativeIdentity');
    window.location.reload();
  }, []);

  // Loading states
  if (isLoadingIdentity) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content">Initializing identity...</p>
        </div>
      </div>
    );
  }

  // Custom loading component with timeout reset option
  const loadingComponent = (
    <div className="flex items-center justify-center min-h-screen bg-base-200">
      <div className="text-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="mt-4 text-base-content">Loading workspace...</p>
        {loadTimeout && (
          <div className="mt-6">
            <p className="text-sm text-base-content/60 mb-3">
              Das Laden dauert länger als erwartet.
            </p>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                localStorage.removeItem('unifiedDocId');
                window.location.hash = '';
                window.location.reload();
              }}
            >
              Neuen Workspace erstellen
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Module Switcher component for navbar
  const moduleSwitcher = doc ? (
    <ModuleSwitcher
      modules={AVAILABLE_MODULES}
      enabledModules={doc.enabledModules || { narrative: true }}
      activeModule={activeModule}
      onModuleChange={setActiveModule}
    />
  ) : null;

  return (
    <AppLayout
      doc={doc}
      docHandle={docHandle}
      documentId={documentId?.toString() ?? ''}
      currentUserDid={identity?.did ?? ''}
      appTitle="Narrative"
      workspaceName={doc?.context?.name || 'Workspace'}
      hideWorkspaceSwitcher={false}
      logoUrl={logoUrl}
      onResetIdentity={handleResetIdentity}
      onCreateWorkspace={handleCreateWorkspace}
      navbarChildren={moduleSwitcher}
      loadingComponent={loadingComponent}
    >
      {(ctx: AppContextValue) => (
        <>
          {/* Module Content */}
          {activeModule === 'map' ? (
            // Map module: fullscreen flex layout
            <div className="flex-1 relative overflow-hidden">
              {doc && docHandle && identity && (
                <MapModuleWrapper
                  doc={doc}
                  docHandle={docHandle}
                  identity={identity}
                  hiddenUserDids={ctx.hiddenUserDids}
                />
              )}
            </div>
          ) : (
            // Other modules: scrollable container with padding
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="container mx-auto p-10 pt-8 pb-24 max-w-6xl w-full">
                {activeModule === 'narrative' && doc?.data.narrative && docHandle && identity && (
                  <NarrativeModuleWrapper
                    doc={doc}
                    docHandle={docHandle}
                    identity={identity}
                    hiddenUserDids={ctx.hiddenUserDids}
                  />
                )}

                {activeModule === 'market' && doc && docHandle && identity && (
                  <MarketModuleWrapper
                    doc={doc}
                    docHandle={docHandle}
                    identity={identity}
                    hiddenUserDids={ctx.hiddenUserDids}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
