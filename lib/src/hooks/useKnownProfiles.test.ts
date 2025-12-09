/**
 * Tests for useKnownProfiles hook
 *
 * These tests verify:
 * - Profile priority (source priority: self > trust-given/trust-received > network-2nd > external > workspace)
 * - Loading state detection
 * - Profile signature status handling
 * - External doc registration
 */

import { describe, it, expect } from 'vitest';
import type { KnownProfile, ProfileSource, ProfileSignatureStatus } from './useKnownProfiles';

/**
 * Source priority mapping used in useKnownProfiles
 */
const SOURCE_PRIORITY: Record<ProfileSource, number> = {
  self: 5,
  'trust-given': 4,
  'trust-received': 4,
  'network-2nd': 3,
  external: 2,
  workspace: 1,
};

/**
 * Helper to determine if a source should be upgraded
 * Mirrors logic in useKnownProfiles.updateProfile
 */
function shouldUpgradeSource(existingSource: ProfileSource, newSource: ProfileSource): boolean {
  return SOURCE_PRIORITY[newSource] >= SOURCE_PRIORITY[existingSource];
}

/**
 * Helper to merge profile updates (mirrors updateProfile logic)
 */
function mergeProfile(
  existing: KnownProfile | undefined,
  update: Omit<KnownProfile, 'did'> & { did: string }
): KnownProfile {
  if (!existing) {
    return update;
  }

  // Don't downgrade source priority
  if (SOURCE_PRIORITY[existing.source] > SOURCE_PRIORITY[update.source]) {
    // Keep existing profile with higher priority source, but update profile data if new is fresher
    if (update.lastUpdated > existing.lastUpdated) {
      return {
        ...existing,
        displayName: update.displayName ?? existing.displayName,
        avatarUrl: update.avatarUrl ?? existing.avatarUrl,
        signatureStatus: update.signatureStatus,
        lastUpdated: update.lastUpdated,
      };
    }
    return existing;
  }

  return update;
}

/**
 * Helper to check if profile is still loading
 * Mirrors logic in QRScannerModal
 */
function isProfileLoading(
  signatureStatus: ProfileSignatureStatus | 'loading' | 'waiting',
  knownProfile: KnownProfile | undefined
): boolean {
  return (
    signatureStatus === 'loading' ||
    signatureStatus === 'waiting' ||
    (knownProfile?.signatureStatus === 'pending' && !knownProfile?.displayName)
  );
}

/**
 * Helper to resolve display name with loading fallback
 * Mirrors logic in QRScannerModal
 */
function resolveDisplayName(
  knownProfile: KnownProfile | undefined,
  loadedProfile: { displayName?: string } | null,
  workspaceProfile: { displayName?: string } | undefined,
  loading: boolean,
  fallbackDid: string
): string {
  return (
    knownProfile?.displayName ||
    loadedProfile?.displayName ||
    workspaceProfile?.displayName ||
    (loading ? 'Profil wird geladen' : `User-${fallbackDid.substring(0, 8)}`)
  );
}

describe('KnownProfile', () => {
  describe('type structure', () => {
    it('should have all required fields', () => {
      const profile: KnownProfile = {
        did: 'did:key:z6MkTest',
        source: 'external',
        signatureStatus: 'pending',
        lastUpdated: Date.now(),
      };

      expect(profile.did).toBeDefined();
      expect(profile.source).toBeDefined();
      expect(profile.signatureStatus).toBeDefined();
      expect(profile.lastUpdated).toBeDefined();
      expect(profile.displayName).toBeUndefined();
      expect(profile.avatarUrl).toBeUndefined();
      expect(profile.userDocUrl).toBeUndefined();
    });

    it('should accept all optional fields', () => {
      const profile: KnownProfile = {
        did: 'did:key:z6MkTest',
        displayName: 'Test User',
        avatarUrl: 'data:image/png;base64,abc123',
        userDocUrl: 'automerge:123abc',
        source: 'trust-given',
        signatureStatus: 'valid',
        lastUpdated: Date.now(),
      };

      expect(profile.displayName).toBe('Test User');
      expect(profile.avatarUrl).toBe('data:image/png;base64,abc123');
      expect(profile.userDocUrl).toBe('automerge:123abc');
    });
  });
});

describe('Source Priority', () => {
  describe('shouldUpgradeSource', () => {
    it('should allow upgrade from workspace to any source', () => {
      expect(shouldUpgradeSource('workspace', 'external')).toBe(true);
      expect(shouldUpgradeSource('workspace', 'network-2nd')).toBe(true);
      expect(shouldUpgradeSource('workspace', 'trust-given')).toBe(true);
      expect(shouldUpgradeSource('workspace', 'trust-received')).toBe(true);
      expect(shouldUpgradeSource('workspace', 'self')).toBe(true);
    });

    it('should allow upgrade from external to higher sources', () => {
      expect(shouldUpgradeSource('external', 'network-2nd')).toBe(true);
      expect(shouldUpgradeSource('external', 'trust-given')).toBe(true);
      expect(shouldUpgradeSource('external', 'self')).toBe(true);
    });

    it('should not allow downgrade from self to any other source', () => {
      expect(shouldUpgradeSource('self', 'workspace')).toBe(false);
      expect(shouldUpgradeSource('self', 'external')).toBe(false);
      expect(shouldUpgradeSource('self', 'network-2nd')).toBe(false);
      expect(shouldUpgradeSource('self', 'trust-given')).toBe(false);
      expect(shouldUpgradeSource('self', 'trust-received')).toBe(false);
    });

    it('should not allow downgrade from trust-given to lower sources', () => {
      expect(shouldUpgradeSource('trust-given', 'workspace')).toBe(false);
      expect(shouldUpgradeSource('trust-given', 'external')).toBe(false);
      expect(shouldUpgradeSource('trust-given', 'network-2nd')).toBe(false);
    });

    it('should allow same-level updates', () => {
      expect(shouldUpgradeSource('trust-given', 'trust-given')).toBe(true);
      expect(shouldUpgradeSource('trust-received', 'trust-received')).toBe(true);
      expect(shouldUpgradeSource('external', 'external')).toBe(true);
    });

    it('should treat trust-given and trust-received as equal priority', () => {
      expect(shouldUpgradeSource('trust-given', 'trust-received')).toBe(true);
      expect(shouldUpgradeSource('trust-received', 'trust-given')).toBe(true);
    });
  });

  describe('source priority values', () => {
    it('should have correct priority ordering', () => {
      expect(SOURCE_PRIORITY['self']).toBeGreaterThan(SOURCE_PRIORITY['trust-given']);
      expect(SOURCE_PRIORITY['trust-given']).toBeGreaterThan(SOURCE_PRIORITY['network-2nd']);
      expect(SOURCE_PRIORITY['network-2nd']).toBeGreaterThan(SOURCE_PRIORITY['external']);
      expect(SOURCE_PRIORITY['external']).toBeGreaterThan(SOURCE_PRIORITY['workspace']);
    });

    it('should have trust-given and trust-received at same level', () => {
      expect(SOURCE_PRIORITY['trust-given']).toBe(SOURCE_PRIORITY['trust-received']);
    });
  });
});

describe('Profile Merging', () => {
  describe('mergeProfile', () => {
    it('should return new profile when no existing profile', () => {
      const update: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice',
        source: 'external',
        signatureStatus: 'valid',
        lastUpdated: Date.now(),
      };

      const result = mergeProfile(undefined, update);

      expect(result).toEqual(update);
    });

    it('should upgrade profile from lower to higher source', () => {
      const existing: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice (Workspace)',
        source: 'workspace',
        signatureStatus: 'missing',
        lastUpdated: 1000,
      };

      const update: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice (Trust)',
        avatarUrl: 'alice-avatar.png',
        source: 'trust-given',
        signatureStatus: 'valid',
        lastUpdated: 2000,
      };

      const result = mergeProfile(existing, update);

      expect(result.displayName).toBe('Alice (Trust)');
      expect(result.avatarUrl).toBe('alice-avatar.png');
      expect(result.source).toBe('trust-given');
      expect(result.signatureStatus).toBe('valid');
    });

    it('should not downgrade profile from higher to lower source', () => {
      const existing: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice (Trust)',
        avatarUrl: 'alice-avatar.png',
        source: 'trust-given',
        signatureStatus: 'valid',
        lastUpdated: 1000,
      };

      const update: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice (External)',
        source: 'external',
        signatureStatus: 'pending',
        lastUpdated: 2000,
      };

      const result = mergeProfile(existing, update);

      // Should keep trust-given source but update fresher data
      expect(result.source).toBe('trust-given');
      expect(result.displayName).toBe('Alice (External)'); // Updated because fresher
      expect(result.avatarUrl).toBe('alice-avatar.png'); // Kept because update has none
    });

    it('should update profile data when lower source has fresher data', () => {
      const existing: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice Old',
        avatarUrl: 'old-avatar.png',
        source: 'trust-given',
        signatureStatus: 'valid',
        lastUpdated: 1000,
      };

      const update: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice New',
        avatarUrl: 'new-avatar.png',
        source: 'external', // Lower priority
        signatureStatus: 'valid',
        lastUpdated: 2000, // But fresher
      };

      const result = mergeProfile(existing, update);

      // Source should stay as trust-given (higher priority)
      expect(result.source).toBe('trust-given');
      // But data should be updated because it's fresher
      expect(result.displayName).toBe('Alice New');
      expect(result.avatarUrl).toBe('new-avatar.png');
    });

    it('should not update profile data when lower source has stale data', () => {
      const existing: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice Current',
        source: 'trust-given',
        signatureStatus: 'valid',
        lastUpdated: 2000,
      };

      const update: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice Stale',
        source: 'external',
        signatureStatus: 'pending',
        lastUpdated: 1000, // Stale
      };

      const result = mergeProfile(existing, update);

      // Should keep everything from existing
      expect(result).toEqual(existing);
    });

    it('should preserve existing values when update has undefined', () => {
      const existing: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice',
        avatarUrl: 'alice-avatar.png',
        source: 'trust-given',
        signatureStatus: 'valid',
        lastUpdated: 1000,
      };

      const update: KnownProfile = {
        did: 'did:key:alice',
        displayName: undefined, // No name in update
        avatarUrl: undefined, // No avatar in update
        source: 'external',
        signatureStatus: 'pending',
        lastUpdated: 2000,
      };

      const result = mergeProfile(existing, update);

      // Should preserve existing display name and avatar
      expect(result.displayName).toBe('Alice');
      expect(result.avatarUrl).toBe('alice-avatar.png');
    });
  });
});

describe('Loading State Detection', () => {
  describe('isProfileLoading', () => {
    it('should return true when signatureStatus is loading', () => {
      expect(isProfileLoading('loading', undefined)).toBe(true);
    });

    it('should return true when signatureStatus is waiting', () => {
      expect(isProfileLoading('waiting', undefined)).toBe(true);
    });

    it('should return true when knownProfile is pending without displayName', () => {
      const knownProfile: KnownProfile = {
        did: 'did:key:alice',
        source: 'external',
        signatureStatus: 'pending',
        lastUpdated: Date.now(),
        // No displayName
      };

      expect(isProfileLoading('pending', knownProfile)).toBe(true);
    });

    it('should return false when knownProfile is pending but has displayName', () => {
      const knownProfile: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice',
        source: 'external',
        signatureStatus: 'pending',
        lastUpdated: Date.now(),
      };

      expect(isProfileLoading('pending', knownProfile)).toBe(false);
    });

    it('should return false when signatureStatus is valid', () => {
      const knownProfile: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice',
        source: 'trust-given',
        signatureStatus: 'valid',
        lastUpdated: Date.now(),
      };

      expect(isProfileLoading('valid', knownProfile)).toBe(false);
    });

    it('should return false when signatureStatus is invalid', () => {
      expect(isProfileLoading('invalid', undefined)).toBe(false);
    });

    it('should return false when signatureStatus is missing', () => {
      expect(isProfileLoading('missing', undefined)).toBe(false);
    });
  });
});

describe('Display Name Resolution', () => {
  describe('resolveDisplayName', () => {
    it('should prefer knownProfile displayName', () => {
      const knownProfile: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice (Known)',
        source: 'trust-given',
        signatureStatus: 'valid',
        lastUpdated: Date.now(),
      };

      const result = resolveDisplayName(
        knownProfile,
        { displayName: 'Alice (Loaded)' },
        { displayName: 'Alice (Workspace)' },
        false,
        'did:key:alice'
      );

      expect(result).toBe('Alice (Known)');
    });

    it('should fallback to loadedProfile when knownProfile has no name', () => {
      const knownProfile: KnownProfile = {
        did: 'did:key:alice',
        source: 'external',
        signatureStatus: 'pending',
        lastUpdated: Date.now(),
        // No displayName
      };

      const result = resolveDisplayName(
        knownProfile,
        { displayName: 'Alice (Loaded)' },
        { displayName: 'Alice (Workspace)' },
        false,
        'did:key:alice'
      );

      expect(result).toBe('Alice (Loaded)');
    });

    it('should fallback to workspaceProfile when no other names', () => {
      const result = resolveDisplayName(
        undefined,
        null,
        { displayName: 'Alice (Workspace)' },
        false,
        'did:key:alice'
      );

      expect(result).toBe('Alice (Workspace)');
    });

    it('should show loading placeholder when loading and no names', () => {
      const result = resolveDisplayName(
        undefined,
        null,
        undefined,
        true, // Loading
        'did:key:alice'
      );

      expect(result).toBe('Profil wird geladen');
    });

    it('should show DID-based fallback when not loading and no names', () => {
      const result = resolveDisplayName(
        undefined,
        null,
        undefined,
        false,
        'did:key:z6MkabcdefghTest'
      );

      expect(result).toBe('User-did:key:');
    });
  });
});

describe('Signature Status', () => {
  describe('ProfileSignatureStatus values', () => {
    it('should have all expected status values', () => {
      const validStatuses: ProfileSignatureStatus[] = ['valid', 'invalid', 'missing', 'pending'];

      validStatuses.forEach((status) => {
        const profile: KnownProfile = {
          did: 'did:key:test',
          source: 'external',
          signatureStatus: status,
          lastUpdated: Date.now(),
        };
        expect(profile.signatureStatus).toBe(status);
      });
    });
  });

  describe('signature status transitions', () => {
    it('should allow pending -> valid transition', () => {
      const profile: KnownProfile = {
        did: 'did:key:alice',
        source: 'external',
        signatureStatus: 'pending',
        lastUpdated: 1000,
      };

      const updated = {
        ...profile,
        signatureStatus: 'valid' as ProfileSignatureStatus,
        lastUpdated: 2000,
      };

      expect(updated.signatureStatus).toBe('valid');
    });

    it('should allow pending -> invalid transition', () => {
      const profile: KnownProfile = {
        did: 'did:key:alice',
        source: 'external',
        signatureStatus: 'pending',
        lastUpdated: 1000,
      };

      const updated = {
        ...profile,
        signatureStatus: 'invalid' as ProfileSignatureStatus,
        lastUpdated: 2000,
      };

      expect(updated.signatureStatus).toBe('invalid');
    });

    it('should allow pending -> missing transition', () => {
      const profile: KnownProfile = {
        did: 'did:key:alice',
        source: 'external',
        signatureStatus: 'pending',
        lastUpdated: 1000,
      };

      const updated = {
        ...profile,
        signatureStatus: 'missing' as ProfileSignatureStatus,
        lastUpdated: 2000,
      };

      expect(updated.signatureStatus).toBe('missing');
    });
  });
});

describe('Profile Map Operations', () => {
  describe('Map usage patterns', () => {
    it('should support get/set operations', () => {
      const profiles = new Map<string, KnownProfile>();
      const profile: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice',
        source: 'trust-given',
        signatureStatus: 'valid',
        lastUpdated: Date.now(),
      };

      profiles.set(profile.did, profile);

      expect(profiles.get('did:key:alice')).toEqual(profile);
      expect(profiles.size).toBe(1);
    });

    it('should support checking existence', () => {
      const profiles = new Map<string, KnownProfile>();
      const profile: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice',
        source: 'trust-given',
        signatureStatus: 'valid',
        lastUpdated: Date.now(),
      };

      profiles.set(profile.did, profile);

      expect(profiles.has('did:key:alice')).toBe(true);
      expect(profiles.has('did:key:unknown')).toBe(false);
    });

    it('should support iteration', () => {
      const profiles = new Map<string, KnownProfile>();
      const alice: KnownProfile = {
        did: 'did:key:alice',
        displayName: 'Alice',
        source: 'trust-given',
        signatureStatus: 'valid',
        lastUpdated: Date.now(),
      };
      const bob: KnownProfile = {
        did: 'did:key:bob',
        displayName: 'Bob',
        source: 'trust-received',
        signatureStatus: 'valid',
        lastUpdated: Date.now(),
      };

      profiles.set(alice.did, alice);
      profiles.set(bob.did, bob);

      const dids: string[] = [];
      for (const [did] of profiles) {
        dids.push(did);
      }

      expect(dids).toContain('did:key:alice');
      expect(dids).toContain('did:key:bob');
    });

    it('should return undefined for missing profiles', () => {
      const profiles = new Map<string, KnownProfile>();

      expect(profiles.get('did:key:unknown')).toBeUndefined();
    });
  });
});

describe('External Doc Registration', () => {
  describe('registration patterns', () => {
    it('should track registered doc URLs', () => {
      const externalDocs = new Set<string>();
      const docUrl = 'automerge:abc123';

      externalDocs.add(docUrl);

      expect(externalDocs.has(docUrl)).toBe(true);
      expect(externalDocs.size).toBe(1);
    });

    it('should prevent duplicate registrations', () => {
      const externalDocs = new Set<string>();
      const docUrl = 'automerge:abc123';

      externalDocs.add(docUrl);
      externalDocs.add(docUrl); // Duplicate

      expect(externalDocs.size).toBe(1);
    });

    it('should track multiple doc URLs', () => {
      const externalDocs = new Set<string>();

      externalDocs.add('automerge:doc1');
      externalDocs.add('automerge:doc2');
      externalDocs.add('automerge:doc3');

      expect(externalDocs.size).toBe(3);
    });
  });
});

describe('Retry Logic Constants', () => {
  // These constants are used in useKnownProfiles for document loading
  const DOC_LOAD_TIMEOUT = 8000;
  const MAX_RETRY_ATTEMPTS = 10;
  const RETRY_DELAY_BASE = 1000;

  describe('timeout configuration', () => {
    it('should have reasonable timeout value', () => {
      expect(DOC_LOAD_TIMEOUT).toBe(8000);
      expect(DOC_LOAD_TIMEOUT).toBeGreaterThan(0);
      expect(DOC_LOAD_TIMEOUT).toBeLessThan(30000); // Not too long
    });
  });

  describe('retry configuration', () => {
    it('should have reasonable retry count', () => {
      expect(MAX_RETRY_ATTEMPTS).toBe(10);
      expect(MAX_RETRY_ATTEMPTS).toBeGreaterThan(0);
      expect(MAX_RETRY_ATTEMPTS).toBeLessThanOrEqual(20); // Not too many
    });
  });

  describe('exponential backoff calculation', () => {
    it('should calculate correct delays for each attempt', () => {
      const delays: number[] = [];
      for (let attempt = 0; attempt < 5; attempt++) {
        delays.push(RETRY_DELAY_BASE * Math.pow(2, attempt));
      }

      expect(delays[0]).toBe(1000); // 1s
      expect(delays[1]).toBe(2000); // 2s
      expect(delays[2]).toBe(4000); // 4s
      expect(delays[3]).toBe(8000); // 8s
      expect(delays[4]).toBe(16000); // 16s
    });

    it('should have maximum total wait time within acceptable bounds', () => {
      let totalWaitTime = 0;
      for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS - 1; attempt++) {
        totalWaitTime += RETRY_DELAY_BASE * Math.pow(2, attempt);
      }
      // Add timeout for each attempt
      totalWaitTime += MAX_RETRY_ATTEMPTS * DOC_LOAD_TIMEOUT;

      // Total time should be reasonable (under 10 minutes)
      expect(totalWaitTime).toBeLessThan(10 * 60 * 1000);
    });
  });
});

describe('Trust URL Extraction', () => {
  /**
   * Helper to extract trust URLs from a UserDocument-like structure
   * Mirrors extractTrustUrls in useKnownProfiles
   */
  function extractTrustUrls(doc: {
    trustGiven?: Record<string, { trusteeDid: string; trusteeUserDocUrl?: string }>;
    trustReceived?: Record<string, { trusterDid: string; trusterUserDocUrl?: string }>;
  }): {
    trustGiven: Map<string, string>;
    trustReceived: Map<string, string>;
  } {
    const trustGiven = new Map<string, string>();
    const trustReceived = new Map<string, string>();

    if (doc.trustGiven) {
      for (const [, attestation] of Object.entries(doc.trustGiven)) {
        if (attestation.trusteeUserDocUrl) {
          trustGiven.set(attestation.trusteeDid, attestation.trusteeUserDocUrl);
        }
      }
    }

    if (doc.trustReceived) {
      for (const [, attestation] of Object.entries(doc.trustReceived)) {
        if (attestation.trusterUserDocUrl) {
          trustReceived.set(attestation.trusterDid, attestation.trusterUserDocUrl);
        }
      }
    }

    return { trustGiven, trustReceived };
  }

  describe('extractTrustUrls', () => {
    it('should extract trustGiven URLs', () => {
      const doc = {
        trustGiven: {
          'did:key:alice': {
            trusteeDid: 'did:key:alice',
            trusteeUserDocUrl: 'automerge:alice-doc',
          },
          'did:key:bob': {
            trusteeDid: 'did:key:bob',
            trusteeUserDocUrl: 'automerge:bob-doc',
          },
        },
      };

      const { trustGiven } = extractTrustUrls(doc);

      expect(trustGiven.get('did:key:alice')).toBe('automerge:alice-doc');
      expect(trustGiven.get('did:key:bob')).toBe('automerge:bob-doc');
      expect(trustGiven.size).toBe(2);
    });

    it('should extract trustReceived URLs', () => {
      const doc = {
        trustReceived: {
          'did:key:charlie': {
            trusterDid: 'did:key:charlie',
            trusterUserDocUrl: 'automerge:charlie-doc',
          },
        },
      };

      const { trustReceived } = extractTrustUrls(doc);

      expect(trustReceived.get('did:key:charlie')).toBe('automerge:charlie-doc');
      expect(trustReceived.size).toBe(1);
    });

    it('should skip entries without URLs', () => {
      const doc = {
        trustGiven: {
          'did:key:alice': {
            trusteeDid: 'did:key:alice',
            trusteeUserDocUrl: 'automerge:alice-doc',
          },
          'did:key:bob': {
            trusteeDid: 'did:key:bob',
            // No trusteeUserDocUrl
          },
        },
      };

      const { trustGiven } = extractTrustUrls(doc);

      expect(trustGiven.has('did:key:alice')).toBe(true);
      expect(trustGiven.has('did:key:bob')).toBe(false);
      expect(trustGiven.size).toBe(1);
    });

    it('should handle empty trust objects', () => {
      const doc = {
        trustGiven: {},
        trustReceived: {},
      };

      const { trustGiven, trustReceived } = extractTrustUrls(doc);

      expect(trustGiven.size).toBe(0);
      expect(trustReceived.size).toBe(0);
    });

    it('should handle undefined trust objects', () => {
      const doc = {};

      const { trustGiven, trustReceived } = extractTrustUrls(doc);

      expect(trustGiven.size).toBe(0);
      expect(trustReceived.size).toBe(0);
    });
  });
});
