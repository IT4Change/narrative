/**
 * Opinion Graph schema - domain-specific for Assumptions app
 *
 * This schema defines the data structure for tracking assumptions,
 * votes, tags, and edit history.
 */

import type { BaseDocument, UserIdentity } from 'narrative-ui';
import { createBaseDocument } from 'narrative-ui';

/**
 * Vote value type: green (agree), yellow (neutral), red (disagree)
 */
export type VoteValue = 'green' | 'yellow' | 'red';

/**
 * Tag for categorizing assumptions
 */
export interface Tag {
  id: string;
  name: string;
  color?: string;
  createdBy: string; // DID
  createdAt: number;

  // Phase 2: Cryptographic signatures (JWS format)
  signature?: string;
  publicKey?: string;
}

/**
 * Single vote on an assumption by a user
 */
export interface Vote {
  id: string;
  assumptionId: string;
  voterDid: string;
  value: VoteValue;
  createdAt: number;
  updatedAt: number;

  // Phase 2: Cryptographic signatures (JWS format)
  signature?: string;
  publicKey?: string;  // Unused (use lookup in doc.identities instead)
}

/**
 * Edit log entry for an assumption
 */
export interface EditEntry {
  id: string;
  assumptionId: string;
  editorDid: string;
  type: 'create' | 'edit';
  previousSentence: string;
  newSentence: string;
  previousTags?: string[];
  newTags?: string[];
  createdAt: number;

  // Phase 2: Cryptographic signatures (JWS format)
  signature?: string;
  publicKey?: string;
}

/**
 * Core Assumption entity
 * Represents a statement (single sentence) that can be voted on
 */
export interface Assumption {
  id: string;
  sentence: string;
  createdBy: string; // DID
  createdAt: number;
  updatedAt: number;
  tagIds: string[];
  voteIds: string[];
  editLogIds: string[];

  // Phase 2: Cryptographic signatures (JWS format)
  signature?: string;
  publicKey?: string;
}

/**
 * Opinion Graph specific data
 */
export interface OpinionGraphData {
  assumptions: Record<string, Assumption>;
  votes: Record<string, Vote>;
  tags: Record<string, Tag>;
  edits: Record<string, EditEntry>;

  // Legacy fields for backward compatibility
  identity?: UserIdentity;  // DEPRECATED: use doc.identities instead
  createdBy?: string;       // DID of board creator
}

/**
 * Full Opinion Graph Document
 */
export type OpinionGraphDoc = BaseDocument<OpinionGraphData>;

/**
 * Helper type for vote aggregation (computed client-side)
 */
export interface VoteSummary {
  green: number;
  yellow: number;
  red: number;
  total: number;
  userVote?: VoteValue;
}

/**
 * Create empty opinion graph document
 *
 * @param creatorIdentity - Identity of the user creating the document
 * @param workspaceName - Optional workspace name
 * @param workspaceAvatar - Optional workspace avatar (data URL)
 * @returns OpinionGraphDoc with empty collections
 */
export function createEmptyOpinionGraphDoc(
  creatorIdentity: UserIdentity,
  workspaceName?: string,
  workspaceAvatar?: string
): OpinionGraphDoc {
  return createBaseDocument<OpinionGraphData>(
    {
      assumptions: {},
      votes: {},
      tags: {},
      edits: {},
      identity: creatorIdentity,  // Keep for backward compatibility
      createdBy: creatorIdentity.did,
    },
    creatorIdentity,
    workspaceName,
    workspaceAvatar
  );
}

/**
 * Compute vote summary for an assumption
 *
 * @param assumption - The assumption to compute votes for
 * @param allVotes - All votes in the document
 * @param currentUserDid - Optional current user DID to track their vote
 * @returns Vote summary with counts and user's vote
 */
export function computeVoteSummary(
  assumption: Assumption,
  allVotes: Record<string, Vote>,
  currentUserDid?: string
): VoteSummary {
  const summary: VoteSummary = {
    green: 0,
    yellow: 0,
    red: 0,
    total: 0,
  };

  // Get all votes for this assumption
  const assumptionVotes = assumption.voteIds
    .map((id) => allVotes[id])
    .filter((v): v is Vote => v !== undefined);

  for (const vote of assumptionVotes) {
    if (vote.value === 'green') summary.green++;
    else if (vote.value === 'yellow') summary.yellow++;
    else if (vote.value === 'red') summary.red++;

    summary.total++;

    // Track current user's vote
    if (currentUserDid && vote.voterDid === currentUserDid) {
      summary.userVote = vote.value;
    }
  }

  return summary;
}

/**
 * Generate a simple unique ID
 * TODO: Replace with proper UUID or content-addressed ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
