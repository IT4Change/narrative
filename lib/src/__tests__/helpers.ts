import { Repo } from '@automerge/automerge-repo';
import type { DocHandle } from '@automerge/automerge-repo';
import * as Automerge from '@automerge/automerge';
import type {
  OpinionGraphDoc,
  Assumption,
  Vote,
  Tag,
  VoteValue,
  UserIdentity,
} from '../schema';
import { createEmptyDoc, generateId } from '../schema';

/**
 * Dummy storage adapter for testing (in-memory only)
 */
class DummyStorageAdapter {
  async load(key: string[]): Promise<Uint8Array | undefined> {
    return undefined;
  }
  async save(key: string[], data: Uint8Array): Promise<void> {}
  async remove(key: string[]): Promise<void> {}
  async loadRange(keyPrefix: string[]): Promise<{ key: string[]; data: Uint8Array }[]> {
    return [];
  }
  async removeRange(keyPrefix: string[]): Promise<void> {}
}

/**
 * Create a test Automerge Repo with in-memory storage
 */
export function createTestRepo(): Repo {
  return new Repo({
    storage: new DummyStorageAdapter(),
  });
}

/**
 * Create a test document with empty Narrative data
 */
export function createTestDoc(identity?: UserIdentity) {
  const repo = createTestRepo();
  const handle = repo.create<OpinionGraphDoc>();

  const defaultIdentity: UserIdentity = identity || {
    did: 'did:key:test-user',
    displayName: 'Test User',
  };

  handle.change((d) => {
    Object.assign(d, createEmptyDoc(defaultIdentity));
  });

  return { repo, handle };
}

/**
 * Create a mock Assumption
 */
export function createMockAssumption(
  overrides?: Partial<Assumption>
): Assumption {
  return {
    id: generateId(),
    sentence: 'Test assumption',
    createdBy: 'did:key:test-user',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tagIds: [],
    voteIds: [],
    editLogIds: [],
    ...overrides,
  };
}

/**
 * Create a mock Vote
 */
export function createMockVote(overrides?: Partial<Vote>): Vote {
  return {
    id: generateId(),
    assumptionId: 'assumption-1',
    voterDid: 'did:key:test-user',
    value: 'green',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a mock Tag
 */
export function createMockTag(overrides?: Partial<Tag>): Tag {
  return {
    id: generateId(),
    name: 'Test Tag',
    createdBy: 'did:key:test-user',
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Wait for two document handles to sync
 * Checks if both documents have identical Automerge heads
 */
export async function waitForSync(
  handle1: DocHandle<any>,
  handle2: DocHandle<any>,
  timeout = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Sync timeout')),
      timeout
    );

    const checkSync = () => {
      const doc1 = handle1.docSync();
      const doc2 = handle2.docSync();

      if (!doc1 || !doc2) {
        setTimeout(checkSync, 50);
        return;
      }

      const heads1 = Automerge.getHeads(doc1);
      const heads2 = Automerge.getHeads(doc2);

      if (JSON.stringify(heads1) === JSON.stringify(heads2)) {
        clearTimeout(timer);
        resolve();
      } else {
        setTimeout(checkSync, 50);
      }
    };

    checkSync();
  });
}

/**
 * Create two connected repos for sync testing
 * Note: For proper sync testing, you need network adapters
 * This is a simplified version for basic tests
 */
export function createConnectedRepos() {
  const repo1 = createTestRepo();
  const repo2 = createTestRepo();

  // Note: Real sync testing would require MessageChannelNetworkAdapter
  // or similar. This is a basic setup for structure testing.

  return { repo1, repo2 };
}
