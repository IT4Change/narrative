# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Narrative is a local-first collaboration platform using Automerge CRDTs for offline-first, real-time collaboration without a central backend. The monorepo contains multiple apps that share a common library.

## Monorepo Structure

```
narrative/
├── narrative-app/   # Assumption tracking app
├── dank-wallet/     # Decentralized voucher/currency system
├── lib/             # Shared library (narrative-ui)
├── shared-config/   # Shared Vite/TypeScript configuration
└── scripts/         # Scaffolding and utility scripts
```

The library (`lib/`) contains shared components, hooks, and utilities used by all apps. **The library must be built before any app** due to this dependency relationship.

## Creating New Apps

Use the scaffolding script to create new apps:

```bash
npm run create-app <app-name> [--port <number>] [--title <string>]

# Example:
npm run create-app dank-wallet --port 3001 --title "Dank Wallet"
```

The script:

- Creates the app directory with proper structure
- Sets up Vite, Tailwind, TypeScript configuration
- Uses the shared `AppShell` component for identity/document management
- Adds convenience scripts to root `package.json`

**IMPORTANT**: All apps MUST use the `AppShell` component from `narrative-ui`. This ensures consistent identity management, document loading, and UI patterns across all apps.

## Development Commands

```bash
# Install dependencies (run from repo root)
npm install

# Development
npm run dev              # Start app dev server (http://localhost:3000)
npm run dev --workspace=lib  # Watch mode for library

# Building
npm run build           # Build both lib and app (lib first, then app)
npm run build:lib       # Build library only
npm run build:app       # Build app only

# Quality
npm run lint            # Lint all workspaces
npm run test            # Run tests (library only, uses vitest)
```

## Architecture

### Library (narrative-ui)

Located in [lib/src/](lib/src/), this package exports:

- **Schema** ([lib/src/schema/index.ts](lib/src/schema/index.ts)): TypeScript types and utilities for the Automerge CRDT document structure
  - Core types: `OpinionGraphDoc`, `Assumption`, `Tag`, `Vote`, `UserIdentity`, `EditEntry`
  - Helper functions: `createEmptyDoc()`, `computeVoteSummary()`, `generateId()`
- **Hooks** ([lib/src/hooks/useOpinionGraph.ts](lib/src/hooks/useOpinionGraph.ts)): Primary React hook for all CRUD operations
  - Mutations: `createAssumption()`, `updateAssumption()`, `deleteAssumption()`, `setVote()`, `removeVote()`, `createTag()`, `updateIdentity()`
  - Queries: `getVoteSummary()`, `getVotesForAssumption()`, `getEditsForAssumption()`

### App (narrative-app)

The React frontend ([app/src/](app/src/)) is structured as:

- **[app/src/main.tsx](app/src/main.tsx)**: Entry point
- **[app/src/App.tsx](app/src/App.tsx)**: Automerge Repo initialization
  - Sets up `IndexedDBStorageAdapter` for local persistence
  - Connects to `wss://sync.automerge.org` for real-time sync
  - Provides `RepoContext` to the app
- **[app/src/NarrativeApp.tsx](app/src/NarrativeApp.tsx)**: Document and identity management
  - Handles document creation/loading from URL hash (`#doc=automerge:...`)
  - Manages user identity (DID-based, stored in `localStorage`)
  - Provides reset and new board functionality
- **[app/src/components/](app/src/components/)**: UI components (AssumptionCard, VoteBar, MainView, etc.)

### Data Flow

1. **Automerge Repo** ([App.tsx:8-14](app/src/App.tsx#L8-L14)) initializes storage and network adapters
2. **Document initialization** ([NarrativeApp.tsx:36-83](app/src/NarrativeApp.tsx#L36-L83)) loads or creates a document
3. **useOpinionGraph hook** consumes the document and provides mutation/query functions
4. **Components** call hook methods to update the CRDT, which auto-syncs across peers

### Identity and Cryptography

The system uses **real Ed25519 keypairs** with proper `did:key` format (not fake DIDs):

- **DID Format**: `did:key:z6Mk...` (base58btc-encoded Ed25519 public key with multicodec prefix)
- **Keypair Generation**: Uses Web Crypto API (`crypto.subtle.generateKey('Ed25519')`)
- **Storage**: Identity stored in `localStorage` as `narrativeIdentity`:

  ```json
  {
    "did": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
    "displayName": "User-abc123",
    "publicKey": "<base64-encoded-32-bytes>",
    "privateKey": "<base64-encoded-pkcs8>"
  }
  ```

**Key utilities** ([lib/src/utils/did.ts](lib/src/utils/did.ts)):

- `generateDidIdentity()` - Create new identity with Ed25519 keypair
- `deriveDidFromPublicKey()` - Derive `did:key` from public key bytes
- `extractPublicKeyFromDid()` - Extract public key from `did:key` for verification
- `isFakeDid()` - Detect legacy fake DIDs for migration

**Signature utilities** ([lib/src/utils/signature.ts](lib/src/utils/signature.ts)):

- `signJws()` - Sign data with JWS (JSON Web Signature) compact serialization
- `verifyJws()` - Verify JWS signature with public key
- `signEntity()` / `verifyEntitySignature()` - Sign/verify CRDT entities

### Document Persistence

- **Document ID**: Stored in both `localStorage` (`${storagePrefix}_docId`) and URL hash (`#doc=...`)
- **URL hash enables document sharing** between users
- **AppShell** handles all document loading/creation logic

### CRDT Document Structure

The root document type is `OpinionGraphDoc` ([lib/src/schema/index.ts:93-107](lib/src/schema/index.ts#L93-L107)):

```typescript
{
  identity: UserIdentity;           // Current user (deprecated, use identities map)
  identities: Record<string, IdentityProfile>;  // Display names by DID
  assumptions: Record<string, Assumption>;      // Normalized by ID
  votes: Record<string, Vote>;                  // Normalized by ID
  tags: Record<string, Tag>;                    // Normalized by ID
  edits: Record<string, EditEntry>;             // Edit history
  version: string;
  lastModified: number;
}
```

Key relationships:
- Each `Assumption` has `tagIds[]` and `voteIds[]` (foreign keys)
- Each `Vote` enforces one vote per user per assumption
- Each `Assumption` has `editLogIds[]` tracking all modifications

### Automerge Mutation Pattern

All document changes use `docHandle.change()` ([useOpinionGraph.ts](lib/src/hooks/useOpinionGraph.ts)):

```typescript
docHandle.change((d) => {
  // Mutate d (mutable proxy of CRDT)
  d.assumptions[id] = newAssumption;
  d.lastModified = Date.now();
});
```

Never mutate the doc directly outside of `.change()` callbacks. Automerge tracks these mutations and handles conflict resolution automatically.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS + DaisyUI
- **CRDT**: Automerge 2.x with automerge-repo React hooks
- **Build**: Vite (app), TypeScript compiler (lib)
- **Testing**: Vitest (library only)

## Common Patterns

- **Adding a new mutation**: Extend `useOpinionGraph` hook with a new function that calls `docHandle.change()`
- **Adding a new entity type**: Update `OpinionGraphDoc` interface and add to `createEmptyDoc()`
- **Modifying UI**: Components are in `app/src/components/`, most consume `useOpinionGraph` hook
- **Identity updates**: Names are propagated to `doc.identities[did]` and existing votes ([useOpinionGraph.ts:336-370](lib/src/hooks/useOpinionGraph.ts#L336-L370))

## Automerge Best Practices

### Critical Rules for CRDT Mutations

**❌ NEVER replace entire arrays or objects**
```typescript
// BAD - Replaces entire array, breaks concurrent edits
assumption.tagIds = newTagIds;

// GOOD - Minimal changes only
const toRemove = assumption.tagIds.filter(id => !newTagIds.includes(id));
const toAdd = newTagIds.filter(id => !assumption.tagIds.includes(id));
toRemove.forEach(id => {
  const idx = assumption.tagIds.indexOf(id);
  if (idx !== -1) assumption.tagIds.splice(idx, 1);
});
toAdd.forEach(id => assumption.tagIds.push(id));
```

**❌ NEVER use immutable-style updates**
```typescript
// BAD - Creates new object, breaks CRDT tracking
doc = {...doc, field: newValue};

// GOOD - Direct mutation inside change callback
changeDoc(d => d.field = newValue);
```

**✅ DO use direct property mutations**
```typescript
docHandle.change((d) => {
  d.assumptions[id] = newAssumption;  // ✅ Direct assignment
  d.assumptions[id].sentence = newText;  // ✅ Direct property update
  d.assumptions[id].tagIds.push(tagId);  // ✅ Array mutation
  delete d.assumptions[id];  // ✅ Delete operator (not undefined)
});
```

### Array Operations Best Practices

**Prefer granular operations:**
- `array.push(item)` - Add to end
- `array.splice(index, 1)` - Remove by index
- `array[index] = value` - Update specific index

**Avoid:**
- `array = [...]` - Full replacement
- `array.sort()` - In-place sorting (sort on read instead)
- Clearing with `array.length = 0` during concurrent edits

### Text Handling

For collaborative text editing, use specialized text operations. For single-value strings (like our assumption sentences), direct assignment is acceptable since they're single-user edits by design.

### React Integration Patterns

**Repository Setup:**
```typescript
// Initialize once at app root
const repo = new Repo({
  storage: new IndexedDBStorageAdapter(),
  network: [new BrowserWebSocketClientAdapter('wss://sync.automerge.org')],
});

// Provide via context
<RepoContext.Provider value={repo}>
  <App />
</RepoContext.Provider>
```

**Document Access:**
```typescript
// In components
const repo = useRepo();
const docHandle = repo.find<MyDocType>(docId);
const [doc] = useDocument<MyDocType>(docId);

// Mutations
const mutate = () => {
  docHandle.change((d) => {
    d.field = newValue;  // Direct mutation
  });
};
```

### Performance Considerations

- Documents maintain full change history
- Split large documents at natural collaboration boundaries
- Avoid denormalization when possible (compute on read)
- For lists with many items, consider pagination on read rather than limiting in CRDT

### Sync and Storage

- **Offline-first**: Changes persist locally, sync when connected
- **No central server required**: Peer-to-peer sync via WebSocket or BroadcastChannel
- **URL-based sharing**: Store document URLs in location hash or localStorage
- **Multi-device**: Same identity can be used across devices with proper key management

### Common Pitfalls to Avoid

1. **Array replacement** - Use splice/push/pop instead of assignment
2. **Sorting during writes** - Sort on read, append during writes
3. **Undefined values** - Use `delete` operator instead
4. **Immutable patterns** - Use direct mutations in change callbacks
5. **Over-normalization** - Balance between denormalization and computed values

## Important Notes

- **Build order matters**: Always build `lib` before `app` when making schema/hook changes
- **Automerge constraints**:
  - Cannot set properties to `undefined` (use delete instead)
  - Mutations must occur inside `.change()` callbacks
  - Document syncs automatically when connected to sync server
- **localStorage usage**: Clearing `narrativeIdentity` creates a new user; clearing `narrativeDocId` creates a new board
- **URL-based sharing**: Document ID in hash allows multiple users to collaborate on the same doc via sync server
- **Network adapter compatibility**: `BroadcastChannelNetworkAdapter` was found to interfere with cross-browser document loading via WebSocket. When a document created in Browser A is opened in Browser B, the BroadcastChannel adapter can prevent the document from syncing properly from the WebSocket server, resulting in endless "Loading document..." spinner. For cross-browser collaboration, use only `BrowserWebSocketClientAdapter`. BroadcastChannel is only useful for same-browser, multi-tab sync, which is a less critical use case.
