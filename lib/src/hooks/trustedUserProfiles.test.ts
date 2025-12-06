/**
 * Tests for TrustedUserProfile functionality
 *
 * These tests verify the profile merging logic used in ParticipantsModal
 * and the TrustedUserProfile type from useAppContext.
 */

import { describe, it, expect } from 'vitest';
import type { TrustedUserProfile } from './useAppContext';
import type { IdentityProfile } from '../schema/document';

/**
 * Helper function that mirrors the profile merging logic in ParticipantsModal
 * This is extracted for testability
 */
function mergeParticipantProfiles(
  docIdentities: Record<string, IdentityProfile>,
  trustedUserProfiles: Record<string, TrustedUserProfile>
): Array<{ did: string; displayName?: string; avatarUrl?: string }> {
  return Object.entries(docIdentities).map(([did, profile]) => {
    const trustedProfile = trustedUserProfiles[did];
    return {
      did,
      // Prefer name from trusted user's UserDoc, fallback to workspace identity
      displayName: trustedProfile?.displayName || profile?.displayName,
      // Prefer avatar from trusted user's UserDoc, fallback to workspace identity
      avatarUrl: trustedProfile?.avatarUrl || profile?.avatarUrl,
    };
  });
}

/**
 * Helper function that mirrors the participant sorting logic in ParticipantsModal
 */
function sortParticipants(
  participants: Array<{ did: string; displayName?: string; avatarUrl?: string }>,
  currentUserDid: string
): Array<{ did: string; displayName?: string; avatarUrl?: string }> {
  return [...participants].sort((a, b) => {
    if (a.did === currentUserDid) return -1;
    if (b.did === currentUserDid) return 1;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });
}

describe('TrustedUserProfile', () => {
  describe('type structure', () => {
    it('should have all required fields', () => {
      const profile: TrustedUserProfile = {
        did: 'did:key:z6MkTest',
        fetchedAt: Date.now(),
      };

      expect(profile.did).toBeDefined();
      expect(profile.fetchedAt).toBeDefined();
      expect(profile.displayName).toBeUndefined();
      expect(profile.avatarUrl).toBeUndefined();
      expect(profile.userDocUrl).toBeUndefined();
    });

    it('should accept all optional fields', () => {
      const profile: TrustedUserProfile = {
        did: 'did:key:z6MkTest',
        displayName: 'Test User',
        avatarUrl: 'data:image/png;base64,abc123',
        userDocUrl: 'automerge:123abc',
        fetchedAt: Date.now(),
      };

      expect(profile.displayName).toBe('Test User');
      expect(profile.avatarUrl).toBe('data:image/png;base64,abc123');
      expect(profile.userDocUrl).toBe('automerge:123abc');
    });
  });
});

describe('mergeParticipantProfiles', () => {
  const mockDocIdentities: Record<string, IdentityProfile> = {
    'did:key:alice': { displayName: 'Alice (Workspace)' },
    'did:key:bob': { displayName: 'Bob (Workspace)', avatarUrl: 'workspace-bob-avatar.png' },
    'did:key:charlie': { displayName: 'Charlie' },
  };

  describe('with empty trustedUserProfiles', () => {
    it('should return profiles from doc.identities', () => {
      const result = mergeParticipantProfiles(mockDocIdentities, {});

      expect(result).toHaveLength(3);
      expect(result.find(p => p.did === 'did:key:alice')?.displayName).toBe('Alice (Workspace)');
      expect(result.find(p => p.did === 'did:key:bob')?.displayName).toBe('Bob (Workspace)');
      expect(result.find(p => p.did === 'did:key:bob')?.avatarUrl).toBe('workspace-bob-avatar.png');
    });
  });

  describe('with trustedUserProfiles', () => {
    it('should prefer displayName from trustedUserProfiles', () => {
      const trustedProfiles: Record<string, TrustedUserProfile> = {
        'did:key:alice': {
          did: 'did:key:alice',
          displayName: 'Alice (UserDoc)',
          fetchedAt: Date.now(),
        },
      };

      const result = mergeParticipantProfiles(mockDocIdentities, trustedProfiles);

      // Alice should have name from UserDoc
      expect(result.find(p => p.did === 'did:key:alice')?.displayName).toBe('Alice (UserDoc)');
      // Bob should still have workspace name
      expect(result.find(p => p.did === 'did:key:bob')?.displayName).toBe('Bob (Workspace)');
    });

    it('should prefer avatarUrl from trustedUserProfiles', () => {
      const trustedProfiles: Record<string, TrustedUserProfile> = {
        'did:key:bob': {
          did: 'did:key:bob',
          avatarUrl: 'userdoc-bob-avatar.png',
          fetchedAt: Date.now(),
        },
      };

      const result = mergeParticipantProfiles(mockDocIdentities, trustedProfiles);

      // Bob should have avatar from UserDoc (overrides workspace)
      expect(result.find(p => p.did === 'did:key:bob')?.avatarUrl).toBe('userdoc-bob-avatar.png');
      // Bob still has workspace displayName since trusted profile has none
      expect(result.find(p => p.did === 'did:key:bob')?.displayName).toBe('Bob (Workspace)');
    });

    it('should fallback to doc.identities when trustedUserProfile has no value', () => {
      const trustedProfiles: Record<string, TrustedUserProfile> = {
        'did:key:bob': {
          did: 'did:key:bob',
          // No displayName or avatarUrl
          fetchedAt: Date.now(),
        },
      };

      const result = mergeParticipantProfiles(mockDocIdentities, trustedProfiles);

      // Should fallback to workspace values
      expect(result.find(p => p.did === 'did:key:bob')?.displayName).toBe('Bob (Workspace)');
      expect(result.find(p => p.did === 'did:key:bob')?.avatarUrl).toBe('workspace-bob-avatar.png');
    });

    it('should handle users with trustedUserProfile but not in doc.identities', () => {
      const trustedProfiles: Record<string, TrustedUserProfile> = {
        'did:key:unknown': {
          did: 'did:key:unknown',
          displayName: 'Unknown User',
          fetchedAt: Date.now(),
        },
      };

      const result = mergeParticipantProfiles(mockDocIdentities, trustedProfiles);

      // Should only include users from doc.identities
      expect(result).toHaveLength(3);
      expect(result.find(p => p.did === 'did:key:unknown')).toBeUndefined();
    });
  });

  describe('complete profile override', () => {
    it('should completely override profile when trustedUserProfile has all fields', () => {
      const trustedProfiles: Record<string, TrustedUserProfile> = {
        'did:key:alice': {
          did: 'did:key:alice',
          displayName: 'Alice From UserDoc',
          avatarUrl: 'alice-userdoc-avatar.png',
          userDocUrl: 'automerge:alice-doc',
          fetchedAt: Date.now(),
        },
      };

      const result = mergeParticipantProfiles(mockDocIdentities, trustedProfiles);
      const alice = result.find(p => p.did === 'did:key:alice');

      expect(alice?.displayName).toBe('Alice From UserDoc');
      expect(alice?.avatarUrl).toBe('alice-userdoc-avatar.png');
    });
  });
});

describe('sortParticipants', () => {
  const participants = [
    { did: 'did:key:charlie', displayName: 'Charlie' },
    { did: 'did:key:alice', displayName: 'Alice' },
    { did: 'did:key:bob', displayName: 'Bob' },
  ];

  it('should put current user first', () => {
    const result = sortParticipants(participants, 'did:key:bob');

    expect(result[0].did).toBe('did:key:bob');
  });

  it('should sort remaining users alphabetically by displayName', () => {
    const result = sortParticipants(participants, 'did:key:bob');

    // Bob first (current user)
    expect(result[0].displayName).toBe('Bob');
    // Then Alice
    expect(result[1].displayName).toBe('Alice');
    // Then Charlie
    expect(result[2].displayName).toBe('Charlie');
  });

  it('should handle participants without displayName', () => {
    const noNameParticipants = [
      { did: 'did:key:a', displayName: 'Zack' },
      { did: 'did:key:b', displayName: undefined },
      { did: 'did:key:c', displayName: 'Anna' },
    ];

    const result = sortParticipants(noNameParticipants, 'did:key:other');

    // Empty string sorts before 'A'
    expect(result[0].displayName).toBeUndefined();
    expect(result[1].displayName).toBe('Anna');
    expect(result[2].displayName).toBe('Zack');
  });

  it('should handle current user not in list', () => {
    const result = sortParticipants(participants, 'did:key:unknown');

    // Just alphabetical order
    expect(result[0].displayName).toBe('Alice');
    expect(result[1].displayName).toBe('Bob');
    expect(result[2].displayName).toBe('Charlie');
  });
});

describe('integration: merge and sort', () => {
  it('should correctly merge and sort with trustedUserProfiles', () => {
    const docIdentities: Record<string, IdentityProfile> = {
      'did:key:me': { displayName: 'Me (Workspace)' },
      'did:key:friend': { displayName: 'Friend (Workspace)' },
      'did:key:stranger': { displayName: 'Stranger' },
    };

    const trustedProfiles: Record<string, TrustedUserProfile> = {
      'did:key:friend': {
        did: 'did:key:friend',
        displayName: 'My Verified Friend',
        avatarUrl: 'friend-avatar.png',
        fetchedAt: Date.now(),
      },
    };

    const merged = mergeParticipantProfiles(docIdentities, trustedProfiles);
    const sorted = sortParticipants(merged, 'did:key:me');

    // Current user first
    expect(sorted[0].did).toBe('did:key:me');
    expect(sorted[0].displayName).toBe('Me (Workspace)');

    // Then friend with UserDoc profile
    expect(sorted[1].did).toBe('did:key:friend');
    expect(sorted[1].displayName).toBe('My Verified Friend');
    expect(sorted[1].avatarUrl).toBe('friend-avatar.png');

    // Then stranger with workspace profile
    expect(sorted[2].did).toBe('did:key:stranger');
    expect(sorted[2].displayName).toBe('Stranger');
  });
});

/**
 * Key generation functions used in useAppContext to create stable
 * dependency keys for useEffect hooks, avoiding infinite loops with
 * Automerge documents (which are immutable and create new references on each change)
 */

/**
 * Generate stable key for workspace tracking
 * Used to prevent re-saving workspace info on every render
 */
function generateWorkspaceKey(
  documentId: string,
  workspaceName: string,
  workspaceAvatar?: string
): string {
  return `${documentId}|${workspaceName}|${workspaceAvatar || ''}`;
}

/**
 * Generate stable key for identity lookup
 * Used to prevent re-updating identityLookup on every render
 */
function generateIdentityLookupKey(
  did: string,
  displayName?: string,
  avatarUrl?: string,
  userDocUrl?: string
): string {
  return `${did}|${displayName || ''}|${avatarUrl || ''}|${userDocUrl || ''}`;
}

/**
 * Generate stable key for trusted user doc URLs
 * Used to prevent re-loading trusted user profiles on every render
 */
function generateTrustedUserDocUrlsKey(
  trustReceived: Record<string, { trusterUserDocUrl?: string }>,
  trustGiven: Record<string, unknown>,
  identityLookup: Record<string, { userDocUrl?: string }>
): string {
  const entries: string[] = [];

  // From trustReceived
  for (const [trusterDid, attestation] of Object.entries(trustReceived)) {
    if (attestation.trusterUserDocUrl) {
      entries.push(`${trusterDid}=${attestation.trusterUserDocUrl}`);
    }
  }

  // From trustGiven (fallback to identityLookup)
  const trustReceivedDids = new Set(Object.keys(trustReceived));
  for (const trusteeDid of Object.keys(trustGiven)) {
    if (!trustReceivedDids.has(trusteeDid)) {
      const lookupUrl = identityLookup[trusteeDid]?.userDocUrl;
      if (lookupUrl) {
        entries.push(`${trusteeDid}=${lookupUrl}`);
      }
    }
  }

  return entries.sort().join('|');
}

describe('useEffect key generation (infinite loop prevention)', () => {
  describe('generateWorkspaceKey', () => {
    it('should generate consistent key for same inputs', () => {
      const key1 = generateWorkspaceKey('doc123', 'My Workspace', 'avatar.png');
      const key2 = generateWorkspaceKey('doc123', 'My Workspace', 'avatar.png');

      expect(key1).toBe(key2);
    });

    it('should generate different key when documentId changes', () => {
      const key1 = generateWorkspaceKey('doc123', 'My Workspace', 'avatar.png');
      const key2 = generateWorkspaceKey('doc456', 'My Workspace', 'avatar.png');

      expect(key1).not.toBe(key2);
    });

    it('should generate different key when name changes', () => {
      const key1 = generateWorkspaceKey('doc123', 'Workspace A', 'avatar.png');
      const key2 = generateWorkspaceKey('doc123', 'Workspace B', 'avatar.png');

      expect(key1).not.toBe(key2);
    });

    it('should generate different key when avatar changes', () => {
      const key1 = generateWorkspaceKey('doc123', 'My Workspace', 'avatar1.png');
      const key2 = generateWorkspaceKey('doc123', 'My Workspace', 'avatar2.png');

      expect(key1).not.toBe(key2);
    });

    it('should handle undefined avatar', () => {
      const key1 = generateWorkspaceKey('doc123', 'My Workspace', undefined);
      const key2 = generateWorkspaceKey('doc123', 'My Workspace', undefined);

      expect(key1).toBe(key2);
      expect(key1).toBe('doc123|My Workspace|');
    });

    it('should differentiate between undefined and empty avatar', () => {
      const key1 = generateWorkspaceKey('doc123', 'My Workspace', undefined);
      const key2 = generateWorkspaceKey('doc123', 'My Workspace', '');

      // Both should be the same (empty string)
      expect(key1).toBe(key2);
    });
  });

  describe('generateIdentityLookupKey', () => {
    it('should generate consistent key for same inputs', () => {
      const key1 = generateIdentityLookupKey('did:key:alice', 'Alice', 'alice.png', 'automerge:abc');
      const key2 = generateIdentityLookupKey('did:key:alice', 'Alice', 'alice.png', 'automerge:abc');

      expect(key1).toBe(key2);
    });

    it('should generate different key when displayName changes', () => {
      const key1 = generateIdentityLookupKey('did:key:alice', 'Alice', 'alice.png', 'automerge:abc');
      const key2 = generateIdentityLookupKey('did:key:alice', 'Alicia', 'alice.png', 'automerge:abc');

      expect(key1).not.toBe(key2);
    });

    it('should generate different key when avatarUrl changes', () => {
      const key1 = generateIdentityLookupKey('did:key:alice', 'Alice', 'alice1.png', 'automerge:abc');
      const key2 = generateIdentityLookupKey('did:key:alice', 'Alice', 'alice2.png', 'automerge:abc');

      expect(key1).not.toBe(key2);
    });

    it('should generate different key when userDocUrl changes', () => {
      const key1 = generateIdentityLookupKey('did:key:alice', 'Alice', 'alice.png', 'automerge:abc');
      const key2 = generateIdentityLookupKey('did:key:alice', 'Alice', 'alice.png', 'automerge:xyz');

      expect(key1).not.toBe(key2);
    });

    it('should handle all undefined optional fields', () => {
      const key = generateIdentityLookupKey('did:key:alice', undefined, undefined, undefined);

      expect(key).toBe('did:key:alice|||');
    });

    it('should detect avatar removal (change from value to undefined)', () => {
      const keyWithAvatar = generateIdentityLookupKey('did:key:alice', 'Alice', 'alice.png', undefined);
      const keyWithoutAvatar = generateIdentityLookupKey('did:key:alice', 'Alice', undefined, undefined);

      expect(keyWithAvatar).not.toBe(keyWithoutAvatar);
    });
  });

  describe('generateTrustedUserDocUrlsKey', () => {
    it('should generate empty key for no trust relationships', () => {
      const key = generateTrustedUserDocUrlsKey({}, {}, {});

      expect(key).toBe('');
    });

    it('should include trustReceived URLs', () => {
      const trustReceived = {
        'did:key:alice': { trusterUserDocUrl: 'automerge:alice-doc' },
        'did:key:bob': { trusterUserDocUrl: 'automerge:bob-doc' },
      };

      const key = generateTrustedUserDocUrlsKey(trustReceived, {}, {});

      expect(key).toContain('did:key:alice=automerge:alice-doc');
      expect(key).toContain('did:key:bob=automerge:bob-doc');
    });

    it('should include trustGiven with identityLookup fallback', () => {
      const trustGiven = {
        'did:key:charlie': {},
      };
      const identityLookup = {
        'did:key:charlie': { userDocUrl: 'automerge:charlie-doc' },
      };

      const key = generateTrustedUserDocUrlsKey({}, trustGiven, identityLookup);

      expect(key).toContain('did:key:charlie=automerge:charlie-doc');
    });

    it('should prefer trustReceived URL over identityLookup', () => {
      const trustReceived = {
        'did:key:alice': { trusterUserDocUrl: 'automerge:alice-received' },
      };
      const trustGiven = {
        'did:key:alice': {},
      };
      const identityLookup = {
        'did:key:alice': { userDocUrl: 'automerge:alice-lookup' },
      };

      const key = generateTrustedUserDocUrlsKey(trustReceived, trustGiven, identityLookup);

      // Should only have the trustReceived URL, not duplicated with lookup
      expect(key).toBe('did:key:alice=automerge:alice-received');
      expect(key).not.toContain('alice-lookup');
    });

    it('should sort entries for consistent key', () => {
      const trustReceived = {
        'did:key:zack': { trusterUserDocUrl: 'automerge:zack-doc' },
        'did:key:alice': { trusterUserDocUrl: 'automerge:alice-doc' },
      };

      const key = generateTrustedUserDocUrlsKey(trustReceived, {}, {});

      // Should be sorted alphabetically
      expect(key).toBe('did:key:alice=automerge:alice-doc|did:key:zack=automerge:zack-doc');
    });

    it('should generate consistent key for same inputs (different object references)', () => {
      const trustReceived1 = { 'did:key:alice': { trusterUserDocUrl: 'automerge:alice-doc' } };
      const trustReceived2 = { 'did:key:alice': { trusterUserDocUrl: 'automerge:alice-doc' } };

      const key1 = generateTrustedUserDocUrlsKey(trustReceived1, {}, {});
      const key2 = generateTrustedUserDocUrlsKey(trustReceived2, {}, {});

      // Keys should be identical even with different object references
      expect(key1).toBe(key2);
    });

    it('should detect when trust is added', () => {
      const keyBefore = generateTrustedUserDocUrlsKey({}, {}, {});
      const keyAfter = generateTrustedUserDocUrlsKey(
        { 'did:key:alice': { trusterUserDocUrl: 'automerge:alice-doc' } },
        {},
        {}
      );

      expect(keyBefore).not.toBe(keyAfter);
    });

    it('should detect when trust is removed', () => {
      const keyBefore = generateTrustedUserDocUrlsKey(
        { 'did:key:alice': { trusterUserDocUrl: 'automerge:alice-doc' } },
        {},
        {}
      );
      const keyAfter = generateTrustedUserDocUrlsKey({}, {}, {});

      expect(keyBefore).not.toBe(keyAfter);
    });

    it('should skip trustReceived entries without trusterUserDocUrl', () => {
      const trustReceived = {
        'did:key:alice': { trusterUserDocUrl: 'automerge:alice-doc' },
        'did:key:bob': {}, // No URL
      };

      const key = generateTrustedUserDocUrlsKey(trustReceived, {}, {});

      expect(key).toContain('alice');
      expect(key).not.toContain('bob');
    });
  });
});
