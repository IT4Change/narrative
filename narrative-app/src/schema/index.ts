/**
 * Narrative App Schema Exports
 * Domain-specific types for the Assumptions/Opinion Graph app
 */

export type {
  VoteValue,
  Tag,
  Vote,
  EditEntry,
  Assumption,
  OpinionGraphData,
  OpinionGraphDoc,
  VoteSummary,
} from './opinion-graph';

export {
  createEmptyOpinionGraphDoc,
  computeVoteSummary,
  generateId,
} from './opinion-graph';
