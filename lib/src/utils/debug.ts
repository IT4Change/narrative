/**
 * Debug utilities for Narrative apps
 *
 * These tools are available in all environments (dev and production)
 * to help with testing and debugging.
 *
 * Access via browser console:
 * - window.__narrative - Debug namespace
 * - window.__userDoc - Current user document
 * - window.__doc - Current workspace document
 */

import type { UserDocument } from '../schema/userDocument';
import type { BaseDocument } from '../schema/document';
import { loadSharedIdentity, type StoredIdentity } from './storage';
import { loadUserDocId } from '../hooks/useUserDocument';

// Type declarations for window object
declare global {
  interface Window {
    __narrative: NarrativeDebug;
    __userDoc: UserDocument | null;
    __doc: BaseDocument<unknown> | null;
    __identity: StoredIdentity | null;
  }
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

  // Workspace Document
  doc: () => BaseDocument<unknown> | null;
  printDoc: () => void;

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
function printUserDocStructure(userDoc: UserDocument | null): void {
  if (!userDoc) {
    console.log('❌ No user document loaded. Set window.__userDoc first.');
    return;
  }

  console.group('👤 User Document');

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
 * Print help information
 */
function printHelp(): void {
  console.log(`
🛠️  Narrative Debug Tools
========================

📌 Quick Access:
  __userDoc              - Current user document
  __doc                  - Current workspace document
  __identity             - Current identity

📌 Commands:
  __narrative.help()           - Show this help
  __narrative.identity()       - Get current identity
  __narrative.exportIdentity() - Export identity to file

  __narrative.userDoc()        - Get user document
  __narrative.printUserDoc()   - Pretty print user document
  __narrative.trustGiven()     - Show outgoing trust
  __narrative.trustReceived()  - Show incoming trust
  __narrative.workspaces()     - Show workspaces
  __narrative.exportUserDoc()  - Export user doc to JSON

  __narrative.doc()            - Get workspace document
  __narrative.printDoc()       - Pretty print workspace doc
  __narrative.exportDoc()      - Export workspace doc to JSON

📌 Tips:
  - Documents are reactive - they update when changes sync
  - Use JSON.stringify(__userDoc, null, 2) for raw JSON
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
      console.log('👤 User Document:', window.__userDoc);
      return window.__userDoc;
    },
    printUserDoc: () => printUserDocStructure(window.__userDoc),
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
    exportUserDoc: () => {
      if (window.__userDoc) {
        exportToJson(window.__userDoc, `narrative-userdoc-${Date.now()}.json`);
      } else {
        console.error('❌ No user document to export');
      }
    },

    // Workspace Document
    doc: () => {
      console.log('📄 Workspace Document:', window.__doc);
      return window.__doc;
    },
    printDoc: () => {
      const doc = window.__doc;
      if (doc) {
        console.group('📄 Workspace Document');
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

    // Help
    help: printHelp,
  };

  // Initialize document holders
  window.__userDoc = null;
  window.__doc = null;
  window.__identity = loadSharedIdentity();

  // Log welcome message
  console.log('🛠️  Narrative Debug Tools loaded! Type __narrative.help() for commands.');
}

/**
 * Update debug state with current documents
 * Call this when documents change
 */
export function updateDebugState(options: {
  userDoc?: UserDocument | null;
  doc?: BaseDocument<unknown> | null;
}): void {
  if (typeof window === 'undefined') return;

  if (options.userDoc !== undefined) {
    window.__userDoc = options.userDoc;
  }
  if (options.doc !== undefined) {
    window.__doc = options.doc;
  }
  window.__identity = loadSharedIdentity();
}