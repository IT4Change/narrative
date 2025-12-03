import { describe, it, expect } from 'vitest';
import {
  generateId,
  computeVoteSummary,
  createEmptyDoc,
  type Assumption,
  type Vote,
  type UserIdentity,
} from './index';

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 10000 }, () => generateId()));
    expect(ids.size).toBe(10000);
  });

  it('should generate non-empty strings', () => {
    const id = generateId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should generate IDs with expected format (timestamp-random)', () => {
    const id = generateId();
    // Format: {timestamp}-{random}
    expect(id).toMatch(/^\d+-[a-z0-9]+$/);
  });

  it('should generate different IDs when called rapidly', () => {
    const id1 = generateId();
    const id2 = generateId();
    const id3 = generateId();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });
});

describe('computeVoteSummary', () => {
  it('should return zeros for assumption with no votes', () => {
    const assumption: Assumption = {
      id: 'a1',
      sentence: 'Test',
      createdBy: 'did:key:test',
      creatorName: 'Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tagIds: [],
      voteIds: [],
      editLogIds: [],
    };

    const allVotes = {};

    const summary = computeVoteSummary(assumption, allVotes);

    expect(summary).toEqual({
      green: 0,
      yellow: 0,
      red: 0,
      total: 0,
    });
  });

  it('should count votes correctly with mixed types', () => {
    const assumption: Assumption = {
      id: 'a1',
      sentence: 'Test',
      createdBy: 'did:key:test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tagIds: [],
      voteIds: ['v1', 'v2', 'v3', 'v4'],
      editLogIds: [],
    };

    const allVotes: Record<string, Vote> = {
      v1: {
        id: 'v1',
        assumptionId: 'a1',
        voterDid: 'did:key:user1',
        voterName: 'User 1',
        value: 'green',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      v2: {
        id: 'v2',
        assumptionId: 'a1',
        voterDid: 'did:key:user2',
        voterName: 'User 2',
        value: 'red',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      v3: {
        id: 'v3',
        assumptionId: 'a1',
        voterDid: 'did:key:user3',
        voterName: 'User 3',
        value: 'green',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      v4: {
        id: 'v4',
        assumptionId: 'a1',
        voterDid: 'did:key:user4',
        voterName: 'User 4',
        value: 'yellow',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    const summary = computeVoteSummary(assumption, allVotes);

    expect(summary).toEqual({
      green: 2,
      yellow: 1,
      red: 1,
      total: 4,
    });
  });

  it('should count only green votes correctly', () => {
    const assumption: Assumption = {
      id: 'a1',
      sentence: 'Test',
      createdBy: 'did:key:test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tagIds: [],
      voteIds: ['v1', 'v2'],
      editLogIds: [],
    };

    const allVotes: Record<string, Vote> = {
      v1: {
        id: 'v1',
        assumptionId: 'a1',
        voterDid: 'did:key:user1',
        value: 'green',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      v2: {
        id: 'v2',
        assumptionId: 'a1',
        voterDid: 'did:key:user2',
        value: 'green',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    const summary = computeVoteSummary(assumption, allVotes);

    expect(summary.green).toBe(2);
    expect(summary.yellow).toBe(0);
    expect(summary.red).toBe(0);
    expect(summary.total).toBe(2);
  });

  it('should track current user vote', () => {
    const currentUserDid = 'did:key:current-user';

    const assumption: Assumption = {
      id: 'a1',
      sentence: 'Test',
      createdBy: 'did:key:test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tagIds: [],
      voteIds: ['v1', 'v2'],
      editLogIds: [],
    };

    const allVotes: Record<string, Vote> = {
      v1: {
        id: 'v1',
        assumptionId: 'a1',
        voterDid: 'did:key:other-user',
        value: 'green',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      v2: {
        id: 'v2',
        assumptionId: 'a1',
        voterDid: currentUserDid,
        value: 'red',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    const summary = computeVoteSummary(assumption, allVotes, currentUserDid);

    expect(summary.userVote).toBe('red');
    expect(summary.green).toBe(1);
    expect(summary.red).toBe(1);
  });

  it('should handle missing votes gracefully', () => {
    const assumption: Assumption = {
      id: 'a1',
      sentence: 'Test',
      createdBy: 'did:key:test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tagIds: [],
      voteIds: ['v1', 'v2', 'v-missing'],
      editLogIds: [],
    };

    const allVotes: Record<string, Vote> = {
      v1: {
        id: 'v1',
        assumptionId: 'a1',
        voterDid: 'did:key:user1',
        value: 'green',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      v2: {
        id: 'v2',
        assumptionId: 'a1',
        voterDid: 'did:key:user2',
        value: 'yellow',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      // v-missing is not in the votes map
    };

    const summary = computeVoteSummary(assumption, allVotes);

    // Should only count existing votes
    expect(summary.green).toBe(1);
    expect(summary.yellow).toBe(1);
    expect(summary.red).toBe(0);
    expect(summary.total).toBe(2);
  });

  it('should not set userVote if current user has not voted', () => {
    const currentUserDid = 'did:key:current-user';

    const assumption: Assumption = {
      id: 'a1',
      sentence: 'Test',
      createdBy: 'did:key:test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tagIds: [],
      voteIds: ['v1'],
      editLogIds: [],
    };

    const allVotes: Record<string, Vote> = {
      v1: {
        id: 'v1',
        assumptionId: 'a1',
        voterDid: 'did:key:other-user',
        value: 'green',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    const summary = computeVoteSummary(assumption, allVotes, currentUserDid);

    expect(summary.userVote).toBeUndefined();
  });
});

describe('createEmptyDoc', () => {
  it('should create document with correct structure', () => {
    const identity: UserIdentity = {
      did: 'did:key:test-user',
      displayName: 'Test User',
    };

    const doc = createEmptyDoc(identity);

    expect(doc).toBeDefined();
    expect(doc.identity).toEqual(identity);
    expect(doc.identities).toBeDefined();
    expect(doc.assumptions).toEqual({});
    expect(doc.votes).toEqual({});
    expect(doc.tags).toEqual({});
    expect(doc.edits).toEqual({});
    expect(doc.version).toBe('0.1.0');
    expect(doc.lastModified).toBeTypeOf('number');
  });

  it('should add identity to identities map', () => {
    const identity: UserIdentity = {
      did: 'did:key:test-user',
      displayName: 'Test User',
    };

    const doc = createEmptyDoc(identity);

    expect(doc.identities['did:key:test-user']).toBeDefined();
    expect(doc.identities['did:key:test-user'].displayName).toBe('Test User');
  });

  it('should set createdBy field', () => {
    const identity: UserIdentity = {
      did: 'did:key:test-user',
      displayName: 'Test User',
    };

    const doc = createEmptyDoc(identity);

    expect(doc.createdBy).toBe('did:key:test-user');
  });

  it('should handle identity with avatarUrl', () => {
    const identity: UserIdentity = {
      did: 'did:key:test-user',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/avatar.png',
    };

    const doc = createEmptyDoc(identity);

    expect(doc.identities['did:key:test-user'].avatarUrl).toBe(
      'https://example.com/avatar.png'
    );
  });

  it('should handle identity with publicKey', () => {
    const identity: UserIdentity = {
      did: 'did:key:test-user',
      displayName: 'Test User',
      publicKey: 'base64-encoded-public-key',
    };

    const doc = createEmptyDoc(identity);

    expect(doc.identities['did:key:test-user'].publicKey).toBe(
      'base64-encoded-public-key'
    );
  });

  it('should create empty collections', () => {
    const identity: UserIdentity = {
      did: 'did:key:test-user',
    };

    const doc = createEmptyDoc(identity);

    expect(Object.keys(doc.assumptions)).toHaveLength(0);
    expect(Object.keys(doc.votes)).toHaveLength(0);
    expect(Object.keys(doc.tags)).toHaveLength(0);
    expect(Object.keys(doc.edits)).toHaveLength(0);
  });

  it('should set lastModified to current time', () => {
    const before = Date.now();
    const identity: UserIdentity = {
      did: 'did:key:test-user',
    };
    const doc = createEmptyDoc(identity);
    const after = Date.now();

    expect(doc.lastModified).toBeGreaterThanOrEqual(before);
    expect(doc.lastModified).toBeLessThanOrEqual(after);
  });
});
