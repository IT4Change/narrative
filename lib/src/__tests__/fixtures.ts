import type {
  OpinionGraphDoc,
  Assumption,
  Vote,
  Tag,
  EditEntry,
  UserIdentity,
} from '../schema';

/**
 * Mock user identities
 */
export const mockIdentities = {
  alice: {
    did: 'did:key:alice',
    displayName: 'Alice',
  } as UserIdentity,
  bob: {
    did: 'did:key:bob',
    displayName: 'Bob',
  } as UserIdentity,
  charlie: {
    did: 'did:key:charlie',
    displayName: 'Charlie',
  } as UserIdentity,
};

/**
 * Mock assumptions
 */
export const mockAssumptions: Record<string, Assumption> = {
  a1: {
    id: 'a1',
    sentence: 'React is better than Vue',
    createdBy: 'did:key:alice',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    tagIds: ['t1', 't2'],
    voteIds: ['v1', 'v2'],
    editLogIds: ['e1'],
  },
  a2: {
    id: 'a2',
    sentence: 'TypeScript improves code quality',
    createdBy: 'did:key:bob',
    createdAt: 1700001000000,
    updatedAt: 1700001000000,
    tagIds: ['t2'],
    voteIds: ['v3'],
    editLogIds: ['e2'],
  },
  a3: {
    id: 'a3',
    sentence: 'Testing is important',
    createdBy: 'did:key:charlie',
    createdAt: 1700002000000,
    updatedAt: 1700002000000,
    tagIds: [],
    voteIds: [],
    editLogIds: ['e3'],
  },
};

/**
 * Mock votes
 */
export const mockVotes: Record<string, Vote> = {
  v1: {
    id: 'v1',
    assumptionId: 'a1',
    voterDid: 'did:key:alice',
    value: 'green',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  v2: {
    id: 'v2',
    assumptionId: 'a1',
    voterDid: 'did:key:bob',
    value: 'red',
    createdAt: 1700000100000,
    updatedAt: 1700000100000,
  },
  v3: {
    id: 'v3',
    assumptionId: 'a2',
    voterDid: 'did:key:charlie',
    value: 'green',
    createdAt: 1700001000000,
    updatedAt: 1700001000000,
  },
};

/**
 * Mock tags
 */
export const mockTags: Record<string, Tag> = {
  t1: {
    id: 't1',
    name: 'Frontend',
    color: '#3b82f6',
    createdBy: 'did:key:alice',
    createdAt: 1700000000000,
  },
  t2: {
    id: 't2',
    name: 'Opinion',
    color: '#8b5cf6',
    createdBy: 'did:key:bob',
    createdAt: 1700000000000,
  },
  t3: {
    id: 't3',
    name: 'Best Practice',
    createdBy: 'did:key:charlie',
    createdAt: 1700002000000,
  },
};

/**
 * Mock edit entries
 */
export const mockEdits: Record<string, EditEntry> = {
  e1: {
    id: 'e1',
    assumptionId: 'a1',
    editorDid: 'did:key:alice',
    type: 'create',
    previousSentence: '',
    newSentence: 'React is better than Vue',
    previousTags: [],
    newTags: ['Frontend', 'Opinion'],
    createdAt: 1700000000000,
  },
  e2: {
    id: 'e2',
    assumptionId: 'a2',
    editorDid: 'did:key:bob',
    type: 'create',
    previousSentence: '',
    newSentence: 'TypeScript improves code quality',
    previousTags: [],
    newTags: ['Opinion'],
    createdAt: 1700001000000,
  },
  e3: {
    id: 'e3',
    assumptionId: 'a3',
    editorDid: 'did:key:charlie',
    type: 'create',
    previousSentence: '',
    newSentence: 'Testing is important',
    previousTags: [],
    newTags: [],
    createdAt: 1700002000000,
  },
};

/**
 * Create a complete mock document
 */
export function createMockDoc(
  overrides?: Partial<OpinionGraphDoc>
): OpinionGraphDoc {
  return {
    identity: mockIdentities.alice,
    identities: {
      'did:key:alice': { displayName: 'Alice' },
      'did:key:bob': { displayName: 'Bob' },
      'did:key:charlie': { displayName: 'Charlie' },
    },
    createdBy: 'did:key:alice',
    assumptions: mockAssumptions,
    votes: mockVotes,
    tags: mockTags,
    edits: mockEdits,
    version: '0.1.0',
    lastModified: Date.now(),
    ...overrides,
  };
}
