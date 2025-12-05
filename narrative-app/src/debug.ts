/**
 * Debug utilities for inspecting Narrative data structure
 * Import this in your component during development to expose data to console
 */

import type { OpinionGraphDoc } from './schema/opinion-graph';
import type { UserDocument } from 'narrative-ui';

/**
 * Helper to resolve DID to display name
 */
function resolveName(doc: OpinionGraphDoc, did: string): string {
  return doc.identities?.[did]?.displayName || did;
}

/**
 * Expose the document to the browser console for debugging
 * Call this from your component: exposeDocToConsole(doc)
 */
export function exposeDocToConsole(doc: OpinionGraphDoc | null) {
  if (typeof window !== 'undefined') {
    (window as any).__narrativeDoc = doc;
    console.log('📊 Narrative document exposed as window.__narrativeDoc');
    console.log('Try: __narrativeDoc.data.assumptions');
    console.log('Try: __narrativeDoc.data.votes');
    console.log('Try: __narrativeDoc.data.tags');
  }
}

/**
 * Expose the user document to the browser console for debugging
 * Call this from your component: exposeUserDocToConsole(userDoc)
 */
export function exposeUserDocToConsole(userDoc: UserDocument | null | undefined) {
  if (typeof window !== 'undefined') {
    (window as any).__userDoc = userDoc;
    console.log('👤 User document exposed as window.__userDoc');
    console.log('Try: __userDoc.trustGiven');
    console.log('Try: __userDoc.trustReceived');
    console.log('Try: __userDoc.profile');
    console.log('Try: __userDoc.workspaces');
  }
}

/**
 * Pretty print user document structure to console
 */
export function printUserDocStructure(userDoc: UserDocument | null | undefined) {
  if (!userDoc) {
    console.log('❌ No user document loaded');
    return;
  }

  console.group('👤 User Document Structure');

  console.group('📋 Profile');
  console.log('DID:', userDoc.did);
  console.log('Display Name:', userDoc.profile.displayName);
  if (userDoc.profile.avatarUrl) {
    console.log('Avatar:', userDoc.profile.avatarUrl.substring(0, 50) + '...');
  }
  console.groupEnd();

  console.group('🤝 Trust Given (' + Object.keys(userDoc.trustGiven || {}).length + ')');
  if (Object.keys(userDoc.trustGiven || {}).length > 0) {
    console.table(Object.values(userDoc.trustGiven).map(t => ({
      trusteeDid: t.trusteeDid.substring(0, 30) + '...',
      level: t.level,
      method: t.verificationMethod,
      createdAt: new Date(t.createdAt).toLocaleString()
    })));
  } else {
    console.log('No outgoing trust attestations');
  }
  console.groupEnd();

  console.group('📥 Trust Received (' + Object.keys(userDoc.trustReceived || {}).length + ')');
  if (Object.keys(userDoc.trustReceived || {}).length > 0) {
    console.table(Object.values(userDoc.trustReceived).map(t => ({
      trusterDid: t.trusterDid.substring(0, 30) + '...',
      level: t.level,
      method: t.verificationMethod,
      createdAt: new Date(t.createdAt).toLocaleString()
    })));
  } else {
    console.log('No incoming trust attestations');
  }
  console.groupEnd();

  console.group('🏢 Workspaces (' + Object.keys(userDoc.workspaces || {}).length + ')');
  if (Object.keys(userDoc.workspaces || {}).length > 0) {
    console.table(Object.values(userDoc.workspaces).map(w => ({
      name: w.name,
      docId: w.docId.substring(0, 40) + '...',
      lastAccessed: w.lastAccessedAt ? new Date(w.lastAccessedAt).toLocaleString() : 'N/A'
    })));
  } else {
    console.log('No workspaces');
  }
  console.groupEnd();

  console.group('🎫 Vouchers (' + Object.keys(userDoc.vouchers || {}).length + ')');
  if (Object.keys(userDoc.vouchers || {}).length > 0) {
    console.table(Object.values(userDoc.vouchers));
  } else {
    console.log('No vouchers');
  }
  console.groupEnd();

  console.group('📊 User Doc Stats');
  console.log('Version:', userDoc.version);
  console.log('Last Modified:', new Date(userDoc.lastModified).toLocaleString());
  console.log('Trust Given:', Object.keys(userDoc.trustGiven || {}).length);
  console.log('Trust Received:', Object.keys(userDoc.trustReceived || {}).length);
  console.log('Workspaces:', Object.keys(userDoc.workspaces || {}).length);
  console.log('Vouchers:', Object.keys(userDoc.vouchers || {}).length);
  console.groupEnd();

  console.groupEnd();
}

/**
 * Analyze trust relationships
 */
export function analyzeTrust(userDoc: UserDocument | null | undefined) {
  if (!userDoc) {
    console.log('❌ No user document loaded');
    return;
  }

  console.group('🔍 Trust Analysis');

  const trustGiven = Object.values(userDoc.trustGiven || {});
  const trustReceived = Object.values(userDoc.trustReceived || {});

  // Find mutual trust
  const mutualTrust = trustGiven.filter(given =>
    trustReceived.some(received => received.trusterDid === given.trusteeDid)
  );

  console.log('📤 Outgoing trust (you trust them):', trustGiven.length);
  console.log('📥 Incoming trust (they trust you):', trustReceived.length);
  console.log('🤝 Mutual trust (bidirectional):', mutualTrust.length);

  if (mutualTrust.length > 0) {
    console.group('Mutual Trust Partners');
    mutualTrust.forEach(t => {
      console.log('- ' + t.trusteeDid.substring(0, 40) + '...');
    });
    console.groupEnd();
  }

  // Pending trust (they trust you, but you don't trust them back)
  const pendingTrust = trustReceived.filter(received =>
    !trustGiven.some(given => given.trusteeDid === received.trusterDid)
  );

  if (pendingTrust.length > 0) {
    console.group('⏳ Pending Trust (they trust you, you don\'t trust back)');
    pendingTrust.forEach(t => {
      console.log('- ' + t.trusterDid.substring(0, 40) + '...');
    });
    console.groupEnd();
  }

  console.groupEnd();
}

/**
 * Pretty print document structure to console
 */
export function printDocStructure(doc: OpinionGraphDoc | null) {
  if (!doc) {
    console.log('❌ No document loaded');
    return;
  }

  console.group('📊 Narrative Document Structure');

  if (doc.data.createdBy) {
    console.group('📋 Board Info');
    console.log('Created by:', doc.data.createdBy);
    const creatorProfile = doc.identities[doc.data.createdBy];
    if (creatorProfile?.displayName) {
      console.log('Creator name:', creatorProfile.displayName);
    }
    console.groupEnd();
  }

  // Show legacy identity if exists (for backward compatibility)
  if (doc.data.identity) {
    console.group('👤 Legacy Identity (deprecated)');
    console.log('DID:', doc.data.identity.did);
    console.log('Name:', doc.data.identity.displayName);
    console.groupEnd();
  }

  console.group('👥 All Identities');
  console.table(doc.identities);
  console.groupEnd();

  console.group('💭 Assumptions (' + Object.keys(doc.data.assumptions).length + ')');
  Object.values(doc.data.assumptions).forEach(a => {
    console.log(`"${a.sentence}" by ${resolveName(doc, a.createdBy)}`);
    console.log(`  Tags: ${a.tagIds.length}, Votes: ${a.voteIds.length}, Edits: ${a.editLogIds.length}`);
  });
  console.groupEnd();

  console.group('🗳️  Votes (' + Object.keys(doc.data.votes).length + ')');
  console.table(Object.values(doc.data.votes).map(v => ({
    voter: resolveName(doc, v.voterDid).substring(0, 20),
    value: v.value,
    assumption: doc.data.assumptions[v.assumptionId]?.sentence.substring(0, 40)
  })));
  console.groupEnd();

  console.group('🏷️  Tags (' + Object.keys(doc.data.tags).length + ')');
  console.table(Object.values(doc.data.tags).map(t => ({
    name: t.name,
    creator: doc.identities[t.createdBy]?.displayName || t.createdBy.substring(0, 20)
  })));
  console.groupEnd();

  console.group('📝 Edit History (' + Object.keys(doc.data.edits).length + ')');
  Object.values(doc.data.edits)
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(e => {
      const time = new Date(e.createdAt).toLocaleString();
      console.log(`[${e.type}] ${resolveName(doc, e.editorDid)} at ${time}`);
      if (e.type === 'edit') {
        console.log(`  Old: "${e.previousSentence}"`);
        console.log(`  New: "${e.newSentence}"`);
      } else {
        console.log(`  Created: "${e.newSentence}"`);
      }
    });
  console.groupEnd();

  console.group('📊 Document Stats');
  console.log('Version:', doc.version);
  console.log('Last Modified:', new Date(doc.lastModified).toLocaleString());
  console.log('Total Assumptions:', Object.keys(doc.data.assumptions).length);
  console.log('Total Votes:', Object.keys(doc.data.votes).length);
  console.log('Total Tags:', Object.keys(doc.data.tags).length);
  console.log('Total Edits:', Object.keys(doc.data.edits).length);
  console.log('Total Users:', Object.keys(doc.identities).length);
  console.groupEnd();

  console.groupEnd();
}

/**
 * Export document to JSON file
 */
export function exportDocToJson(doc: OpinionGraphDoc | null) {
  if (!doc) {
    console.error('❌ No document to export');
    return;
  }

  const json = JSON.stringify(doc, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `narrative-doc-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('✅ Document exported to JSON file');
}

/**
 * Analyze vote patterns
 */
export function analyzeVotes(doc: OpinionGraphDoc | null) {
  if (!doc) return;

  console.group('🔍 Vote Analysis');

  const votesByUser = new Map<string, { green: number; yellow: number; red: number }>();

  Object.values(doc.data.votes).forEach(vote => {
    const name = resolveName(doc, vote.voterDid);
    if (!votesByUser.has(name)) {
      votesByUser.set(name, { green: 0, yellow: 0, red: 0 });
    }
    const stats = votesByUser.get(name)!;
    stats[vote.value]++;
  });

  console.table(Array.from(votesByUser.entries()).map(([user, stats]) => ({
    user,
    '🟢 Agree': stats.green,
    '🟡 Neutral': stats.yellow,
    '🔴 Disagree': stats.red,
    total: stats.green + stats.yellow + stats.red
  })));

  console.groupEnd();
}

/**
 * Find all assumptions by a specific user
 */
export function findAssumptionsByUser(doc: OpinionGraphDoc | null, userDid: string) {
  if (!doc) return [];

  return Object.values(doc.data.assumptions)
    .filter(a => a.createdBy === userDid)
    .map(a => ({
      sentence: a.sentence,
      votes: a.voteIds.length,
      tags: a.tagIds.map(id => doc.data.tags[id]?.name).filter(Boolean)
    }));
}

/**
 * Trace all relationships for an assumption
 */
export function traceAssumption(doc: OpinionGraphDoc | null, assumptionId: string) {
  if (!doc) return;

  const assumption = doc.data.assumptions[assumptionId];
  if (!assumption) {
    console.error('❌ Assumption not found:', assumptionId);
    return;
  }

  console.group(`🔍 Tracing Assumption: "${assumption.sentence}"`);

  console.group('📌 Tags');
  assumption.tagIds.forEach(tagId => {
    const tag = doc.data.tags[tagId];
    if (tag) {
      console.log(`- ${tag.name} (created by ${tag.createdBy})`);
    }
  });
  console.groupEnd();

  console.group('🗳️  Votes');
  assumption.voteIds.forEach(voteId => {
    const vote = doc.data.votes[voteId];
    if (vote) {
      console.log(`- ${vote.value} by ${resolveName(doc, vote.voterDid)}`);
    }
  });
  console.groupEnd();

  console.group('📝 Edit History');
  assumption.editLogIds.forEach(editId => {
    const edit = doc.data.edits[editId];
    if (edit) {
      console.log(`- [${edit.type}] by ${resolveName(doc, edit.editorDid)}`);
      if (edit.type === 'edit') {
        console.log(`  "${edit.previousSentence}" → "${edit.newSentence}"`);
      }
    }
  });
  console.groupEnd();

  console.groupEnd();
}

// Make debug functions available in console
if (typeof window !== 'undefined') {
  (window as any).__narrativeDebug = {
    print: printDocStructure,
    export: exportDocToJson,
    analyze: analyzeVotes,
    trace: traceAssumption,
    findByUser: findAssumptionsByUser,
    // User document functions
    printUser: printUserDocStructure,
    analyzeTrust: analyzeTrust
  };

  console.log('🛠️  Narrative Debug Tools loaded!');
  console.log('Available commands:');
  console.log('  __narrativeDebug.print(doc)     - Print document structure');
  console.log('  __narrativeDebug.export(doc)    - Export document to JSON');
  console.log('  __narrativeDebug.analyze(doc)   - Analyze vote patterns');
  console.log('  __narrativeDebug.trace(doc, id) - Trace assumption relationships');
  console.log('  __narrativeDebug.findByUser(doc, did) - Find user\'s assumptions');
  console.log('');
  console.log('User Document commands:');
  console.log('  __userDoc                       - Access user document directly');
  console.log('  __narrativeDebug.printUser(__userDoc) - Print user document structure');
  console.log('  __narrativeDebug.analyzeTrust(__userDoc) - Analyze trust relationships');
}
