/**
 * Debug utilities for Narrative apps
 *
 * These tools are available in all environments (dev and production)
 * to help with testing and debugging.
 *
 * Access via browser console:
 * - window.__narrative - Debug namespace with all commands
 * - window.__userDoc - Current user document (auto-updated)
 * - window.__doc - Current workspace document (auto-updated)
 *
 * Load any document by ID:
 * - __narrative.loadDoc('automerge:xyz...')
 * - __narrative.loadUserDoc('did:key:z6Mk...')
 *
 * Sync Monitoring:
 * - __narrative.syncStatus() - Show current sync status
 * - __narrative.watchSync(docUrl) - Watch a document's sync in real-time
 */

import type { UserDocument } from '../schema/userDocument';
import type { BaseDocument } from '../schema/document';
import { loadSharedIdentity, type StoredIdentity } from './storage';
import type { Repo, AutomergeUrl, DocHandle } from '@automerge/automerge-repo';
import type { TrustedUserProfile } from '../hooks/useAppContext';

// Internal repo reference for loading arbitrary documents
let _repo: Repo | null = null;

// Internal trusted user profiles reference
let _trustedUserProfiles: Record<string, TrustedUserProfile> = {};

// Active sync watchers for cleanup
const _activeWatchers: SyncWatcher[] = [];

// Type declarations for window object
declare global {
  interface Window {
    __narrative: NarrativeDebug;
    __userDoc: UserDocument | null;
    __userDocUrl: string | null;
    __doc: BaseDocument<unknown> | null;
    __docUrl: string | null;
    __identity: StoredIdentity | null;
  }
}

/**
 * Sync status for a document
 */
export interface DocSyncStatus {
  url: string;
  isLoaded: boolean;
  hasLocalChanges: boolean;
  lastSyncAt: number | null;
  peerCount: number;
}

/**
 * Active sync watcher
 */
interface SyncWatcher {
  handle: DocHandle<unknown>;
  stopWatching: () => void;
}

export interface NarrativeDebug {
  // Identity
  identity: () => StoredIdentity | null;
  exportIdentity: () => void;

  // User Document
  userDoc: () => UserDocument | null;
  printUserDoc: () => void;
  trustGiven: () => void;
  trustReceived: () => void;
  workspaces: () => void;

  // Trusted User Profiles
  trustedProfiles: () => void;

  // Workspace Document
  doc: () => BaseDocument<unknown> | null;
  printDoc: () => void;

  // Load arbitrary documents
  loadDoc: (docId: string) => Promise<unknown>;
  loadUserDoc: (did: string) => Promise<UserDocument | null>;

  // Sync Monitoring
  syncStatus: () => Promise<void>;
  watchSync: (docUrl: string) => Promise<SyncWatcher | null>;
  stopAllWatchers: () => void;
  testSync: (docUrl: string) => Promise<boolean>;

  // Export
  exportUserDoc: () => void;
  exportDoc: () => void;

  // Info
  help: () => void;
  version: string;
}

/**
 * Pretty print user document to console
 */
function printUserDocStructure(userDoc: UserDocument | null, userDocUrl: string | null): void {
  if (!userDoc) {
    console.log('❌ No user document loaded. Set window.__userDoc first.');
    return;
  }

  console.group('👤 User Document');

  if (userDocUrl) {
    console.log('📎 Document URL:', userDocUrl);
  }

  console.group('📋 Profile');
  console.log('DID:', userDoc.did);
  console.log('Display Name:', userDoc.profile.displayName);
  if (userDoc.profile.avatarUrl) {
    console.log('Avatar:', userDoc.profile.avatarUrl.substring(0, 50) + '...');
  }
  console.groupEnd();

  console.group(`🤝 Trust Given (${Object.keys(userDoc.trustGiven || {}).length})`);
  if (Object.keys(userDoc.trustGiven || {}).length > 0) {
    console.table(
      Object.values(userDoc.trustGiven).map((t) => ({
        trusteeDid: t.trusteeDid.substring(0, 30) + '...',
        level: t.level,
        method: t.verificationMethod,
        createdAt: new Date(t.createdAt).toLocaleString(),
      }))
    );
  } else {
    console.log('No outgoing trust attestations');
  }
  console.groupEnd();

  console.group(`📥 Trust Received (${Object.keys(userDoc.trustReceived || {}).length})`);
  if (Object.keys(userDoc.trustReceived || {}).length > 0) {
    console.table(
      Object.values(userDoc.trustReceived).map((t) => ({
        trusterDid: t.trusterDid.substring(0, 30) + '...',
        level: t.level,
        method: t.verificationMethod,
        createdAt: new Date(t.createdAt).toLocaleString(),
      }))
    );
  } else {
    console.log('No incoming trust attestations');
  }
  console.groupEnd();

  console.group(`🏢 Workspaces (${Object.keys(userDoc.workspaces || {}).length})`);
  if (Object.keys(userDoc.workspaces || {}).length > 0) {
    console.table(
      Object.values(userDoc.workspaces).map((w) => ({
        name: w.name,
        docId: w.docId.substring(0, 40) + '...',
        lastAccessed: w.lastAccessedAt
          ? new Date(w.lastAccessedAt).toLocaleString()
          : 'N/A',
      }))
    );
  } else {
    console.log('No workspaces');
  }
  console.groupEnd();

  console.group('📊 Stats');
  console.log('Version:', userDoc.version);
  console.log('Last Modified:', new Date(userDoc.lastModified).toLocaleString());
  console.groupEnd();

  console.groupEnd();
}

/**
 * Export document to JSON file
 */
function exportToJson(data: unknown, filename: string): void {
  if (!data) {
    console.error('❌ No data to export');
    return;
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log(`✅ Exported to ${filename}`);
}

/**
 * Load any document by ID
 */
async function loadDocById(docId: string): Promise<unknown> {
  if (!_repo) {
    console.error('❌ Repo not initialized. Debug tools need to be initialized with a repo.');
    return null;
  }

  // Normalize document ID
  const normalizedId = docId.startsWith('automerge:') ? docId : `automerge:${docId}`;

  console.log(`🔄 Loading document: ${normalizedId.substring(0, 50)}...`);

  try {
    // In automerge-repo v2.x, find() returns a Promise that resolves when ready
    const handle = await _repo.find(normalizedId as AutomergeUrl);
    const doc = handle.doc();

    if (doc) {
      console.log('✅ Document loaded:', doc);
      return doc;
    } else {
      console.error('❌ Document not found or empty');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to load document:', error);
    return null;
  }
}

/**
 * Load a user's UserDocument by their DID
 * Looks up the userDocUrl in trust attestations (trustReceived contains trusterUserDocUrl)
 */
async function loadUserDocByDid(did: string): Promise<UserDocument | null> {
  if (!_repo) {
    console.error('❌ Repo not initialized.');
    return null;
  }

  // Check if we have a userDocUrl for this DID in our trust relationships
  const currentUserDoc = window.__userDoc;
  if (currentUserDoc) {
    // Check trustReceived - attestations have trusterUserDocUrl pointing to the person who trusted us
    const trustReceived = Object.values(currentUserDoc.trustReceived || {});
    for (const attestation of trustReceived) {
      if (attestation.trusterDid === did && attestation.trusterUserDocUrl) {
        console.log(`📍 Found userDocUrl in trustReceived for ${did.substring(0, 30)}...`);
        return (await loadDocById(attestation.trusterUserDocUrl)) as UserDocument | null;
      }
    }

    // Check trustGiven - the attestations we wrote also have trusterUserDocUrl (our own URL)
    // But we need the trustee's URL, which we may have stored when they trusted us back
    // For now, we can only resolve users who have trusted us (their URL is in trustReceived)
  }

  console.error(`❌ No userDocUrl found for DID: ${did.substring(0, 40)}...`);
  console.log('💡 Tip: You can only load UserDocs of users who have trusted you (their URL is in trustReceived).');
  return null;
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
🛠️  Narrative Debug Tools v2.0
===============================

📌 Quick Access:
  __userDoc              - Current user document (auto-updated)
  __doc                  - Current workspace document (auto-updated)
  __identity             - Current identity

📌 Identity:
  __narrative.identity()       - Get current identity
  __narrative.exportIdentity() - Export identity to file

📌 User Document:
  __narrative.userDoc()        - Get user document
  __narrative.printUserDoc()   - Pretty print user document
  __narrative.trustGiven()     - Show outgoing trust
  __narrative.trustReceived()  - Show incoming trust
  __narrative.workspaces()     - Show workspaces
  __narrative.trustedProfiles() - Show loaded profiles from trusted users
  __narrative.exportUserDoc()  - Export user doc to JSON

📌 Workspace Document:
  __narrative.doc()            - Get workspace document
  __narrative.printDoc()       - Pretty print workspace doc
  __narrative.exportDoc()      - Export workspace doc to JSON

📌 Load Any Document:
  __narrative.loadDoc('automerge:xyz...')     - Load any document by ID
  __narrative.loadUserDoc('did:key:z6Mk...')  - Load a user's UserDocument

📌 Tips:
  - Documents are reactive - __userDoc and __doc update automatically
  - Use JSON.stringify(__userDoc, null, 2) for raw JSON
  - loadUserDoc() only works for users you have trust relationships with
  - All commands work in production builds
  `);
}

/**
 * Initialize debug tools
 * Call this once when the app loads
 */
export function initDebugTools(): void {
  if (typeof window === 'undefined') return;

  // Initialize debug namespace
  window.__narrative = {
    version: '1.0.0',

    // Identity
    identity: () => {
      const id = loadSharedIdentity();
      console.log('🪪 Identity:', id);
      return id;
    },
    exportIdentity: () => {
      const identity = loadSharedIdentity();
      if (identity) {
        exportToJson(identity, `narrative-identity-${Date.now()}.json`);
      } else {
        console.error('❌ No identity to export');
      }
    },

    // User Document
    userDoc: () => {
      if (window.__userDocUrl) {
        console.log('📎 User Document URL:', window.__userDocUrl);
      }
      console.log('👤 User Document:', window.__userDoc);
      return window.__userDoc;
    },
    printUserDoc: () => printUserDocStructure(window.__userDoc, window.__userDocUrl),
    trustGiven: () => {
      const doc = window.__userDoc;
      if (doc) {
        console.table(Object.values(doc.trustGiven || {}));
      } else {
        console.log('❌ No user document');
      }
    },
    trustReceived: () => {
      const doc = window.__userDoc;
      if (doc) {
        console.table(Object.values(doc.trustReceived || {}));
      } else {
        console.log('❌ No user document');
      }
    },
    workspaces: () => {
      const doc = window.__userDoc;
      if (doc) {
        console.table(Object.values(doc.workspaces || {}));
      } else {
        console.log('❌ No user document');
      }
    },

    // Trusted User Profiles
    trustedProfiles: () => {
      const profiles = _trustedUserProfiles;
      const count = Object.keys(profiles).length;

      console.group(`👥 Trusted User Profiles (${count})`);

      if (count === 0) {
        console.log('No trusted user profiles loaded.');
        console.log('💡 Profiles are loaded from users who have trusted you (trustReceived).');
      } else {
        console.table(
          Object.values(profiles).map((p) => ({
            did: p.did.substring(0, 35) + '...',
            displayName: p.displayName || '(no name)',
            hasAvatar: p.avatarUrl ? '✅' : '❌',
            userDocUrl: p.userDocUrl ? p.userDocUrl.substring(0, 30) + '...' : '(none)',
            fetchedAt: new Date(p.fetchedAt).toLocaleString(),
          }))
        );

        // Show full details
        console.log('\n📋 Full profile data:');
        for (const profile of Object.values(profiles)) {
          console.log(`  ${profile.displayName || profile.did.substring(0, 20)}:`);
          console.log(`    DID: ${profile.did}`);
          if (profile.avatarUrl) {
            console.log(`    Avatar: ${profile.avatarUrl.substring(0, 60)}...`);
          }
          if (profile.userDocUrl) {
            console.log(`    UserDoc: ${profile.userDocUrl}`);
          }
        }
      }

      console.groupEnd();
      return profiles;
    },

    exportUserDoc: () => {
      if (window.__userDoc) {
        exportToJson(window.__userDoc, `narrative-userdoc-${Date.now()}.json`);
      } else {
        console.error('❌ No user document to export');
      }
    },

    // Workspace Document
    doc: () => {
      if (window.__docUrl) {
        console.log('📎 Document URL:', window.__docUrl);
      }
      console.log('📄 Workspace Document:', window.__doc);
      return window.__doc;
    },
    printDoc: () => {
      const doc = window.__doc;
      if (doc) {
        console.group('📄 Workspace Document');
        if (window.__docUrl) {
          console.log('📎 Document URL:', window.__docUrl);
        }
        console.log('Version:', doc.version);
        console.log('Last Modified:', new Date(doc.lastModified).toLocaleString());
        console.log('Identities:', Object.keys(doc.identities || {}).length);
        console.log('Data:', doc.data);
        console.groupEnd();
      } else {
        console.log('❌ No workspace document');
      }
    },
    exportDoc: () => {
      if (window.__doc) {
        exportToJson(window.__doc, `narrative-doc-${Date.now()}.json`);
      } else {
        console.error('❌ No workspace document to export');
      }
    },

    // Load arbitrary documents
    loadDoc: loadDocById,
    loadUserDoc: loadUserDocByDid,

    // Sync Monitoring
    syncStatus: async () => {
      if (!_repo) {
        console.error('❌ Repo not initialized.');
        return;
      }

      console.group('📡 Sync Status');

      // Check userDoc
      if (window.__userDocUrl) {
        console.group('👤 User Document');
        console.log('URL:', window.__userDocUrl);
        try {
          const handle = await _repo.find<UserDocument>(window.__userDocUrl as AutomergeUrl);
          const doc = handle.doc();
          console.log('Loaded:', !!doc);
          console.log('Last Modified:', doc ? new Date(doc.lastModified).toLocaleString() : 'N/A');
          console.log('Trust Given:', Object.keys(doc?.trustGiven || {}).length);
          console.log('Trust Received:', Object.keys(doc?.trustReceived || {}).length);
        } catch (err) {
          console.error('Failed to check:', err);
        }
        console.groupEnd();
      }

      // Check workspace doc
      if (window.__docUrl) {
        console.group('📄 Workspace Document');
        console.log('URL:', window.__docUrl);
        try {
          const handle = await _repo.find<BaseDocument<unknown>>(window.__docUrl as AutomergeUrl);
          const doc = handle.doc();
          console.log('Loaded:', !!doc);
          console.log('Last Modified:', doc ? new Date(doc.lastModified).toLocaleString() : 'N/A');
          console.log('Identities:', Object.keys(doc?.identities || {}).length);
        } catch (err) {
          console.error('Failed to check:', err);
        }
        console.groupEnd();
      }

      // Network status
      console.group('🌐 Network');
      const networkSubsystem = _repo.networkSubsystem;
      if (networkSubsystem) {
        console.log('Network adapters available');
      } else {
        console.log('No network subsystem');
      }
      console.groupEnd();

      console.groupEnd();
    },

    watchSync: async (docUrl: string) => {
      if (!_repo) {
        console.error('❌ Repo not initialized.');
        return null;
      }

      const normalizedUrl = docUrl.startsWith('automerge:') ? docUrl : `automerge:${docUrl}`;
      console.log(`👁️ Starting sync watcher for: ${normalizedUrl.substring(0, 50)}...`);

      try {
        const handle = await _repo.find(normalizedUrl as AutomergeUrl);

        const changeHandler = ({ doc }: { doc: unknown }) => {
          const timestamp = new Date().toLocaleTimeString();
          console.log(`📥 [${timestamp}] Document changed:`, normalizedUrl.substring(0, 40));
          if (doc && typeof doc === 'object' && 'lastModified' in doc) {
            console.log(`   Last Modified: ${new Date((doc as { lastModified: number }).lastModified).toLocaleString()}`);
          }
        };

        handle.on('change', changeHandler);

        const watcher: SyncWatcher = {
          handle,
          stopWatching: () => {
            handle.off('change', changeHandler);
            console.log(`🛑 Stopped watching: ${normalizedUrl.substring(0, 40)}`);
          }
        };

        _activeWatchers.push(watcher);
        console.log(`✅ Watching for changes. Call __narrative.stopAllWatchers() to stop.`);
        return watcher;
      } catch (err) {
        console.error('❌ Failed to watch document:', err);
        return null;
      }
    },

    stopAllWatchers: () => {
      console.log(`🛑 Stopping ${_activeWatchers.length} watchers...`);
      for (const watcher of _activeWatchers) {
        watcher.stopWatching();
      }
      _activeWatchers.length = 0;
      console.log('✅ All watchers stopped.');
    },

    testSync: async (docUrl: string) => {
      if (!_repo) {
        console.error('❌ Repo not initialized.');
        return false;
      }

      const normalizedUrl = docUrl.startsWith('automerge:') ? docUrl : `automerge:${docUrl}`;
      console.log(`🧪 Testing sync for: ${normalizedUrl.substring(0, 50)}...`);

      const startTime = Date.now();

      try {
        const handle = await _repo.find(normalizedUrl as AutomergeUrl);
        const findTime = Date.now() - startTime;

        const doc = handle.doc();
        const docTime = Date.now() - startTime;

        console.group('📊 Sync Test Results');
        console.log(`Find time: ${findTime}ms`);
        console.log(`Doc ready: ${docTime}ms`);
        console.log(`Document loaded: ${!!doc}`);

        if (doc && typeof doc === 'object') {
          if ('lastModified' in doc) {
            console.log(`Last Modified: ${new Date((doc as { lastModified: number }).lastModified).toLocaleString()}`);
          }
          if ('trustReceived' in doc) {
            console.log(`Trust Received: ${Object.keys((doc as { trustReceived: Record<string, unknown> }).trustReceived || {}).length}`);
          }
          if ('trustGiven' in doc) {
            console.log(`Trust Given: ${Object.keys((doc as { trustGiven: Record<string, unknown> }).trustGiven || {}).length}`);
          }
        }
        console.groupEnd();

        return !!doc;
      } catch (err) {
        console.error('❌ Sync test failed:', err);
        return false;
      }
    },

    // Help
    help: printHelp,
  };

  // Initialize document holders
  window.__userDoc = null;
  window.__userDocUrl = null;
  window.__doc = null;
  window.__docUrl = null;
  window.__identity = loadSharedIdentity();

  // Log welcome message
  console.log('🛠️  Narrative Debug Tools loaded! Type __narrative.help() for commands.');
}

/**
 * Update debug state with current documents and repo
 * Call this when documents change or on app initialization
 */
export function updateDebugState(options: {
  userDoc?: UserDocument | null;
  userDocUrl?: string | null;
  doc?: BaseDocument<unknown> | null;
  docUrl?: string | null;
  repo?: Repo;
  trustedUserProfiles?: Record<string, TrustedUserProfile>;
}): void {
  if (typeof window === 'undefined') return;

  if (options.userDoc !== undefined) {
    window.__userDoc = options.userDoc;
  }
  if (options.userDocUrl !== undefined) {
    window.__userDocUrl = options.userDocUrl;
  }
  if (options.doc !== undefined) {
    window.__doc = options.doc;
  }
  if (options.docUrl !== undefined) {
    window.__docUrl = options.docUrl;
  }
  if (options.repo !== undefined) {
    _repo = options.repo;
  }
  if (options.trustedUserProfiles !== undefined) {
    _trustedUserProfiles = options.trustedUserProfiles;
  }
  window.__identity = loadSharedIdentity();
}