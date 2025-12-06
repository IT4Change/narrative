# Web of Trust Architecture for Narrative

**Status**: Design Phase
**Date**: December 2025
**Related**: [IDENTITY-CONCEPT.md](./IDENTITY-CONCEPT.md)

---

## Executive Summary

This document describes a **Web of Trust** system for Narrative that prevents Sybil attacks, spam, and gaming of the voting system in a decentralized, local-first environment. Users build trust relationships that create a reputation layer on top of our DID-based identity system.

**Key Goals:**
1. Prevent multi-voting by the same person using multiple identities
2. Enable filtering of content by trust level
3. Build community-driven reputation without centralized authority
4. Maintain privacy and user autonomy

---

## Part 1: Problem Statement

### Current Vulnerabilities (Without Web of Trust)

#### 1. Sybil Attacks
**Problem**: One person creates many DIDs and:
- Votes multiple times → manipulates results
- Creates spam assumptions
- Artificially inflates consensus

**Example**:
```
Attacker creates 100 DIDs:
- Real vote distribution: 60% agree, 40% disagree
- After attack: 80% agree (attacker voted "agree" 100 times)
- Legitimate users can't distinguish fake votes
```

#### 2. No Reputation System
**Problem**: All DIDs are equal
- New user = Same weight as established community member
- No way to identify trustworthy contributors
- Can't filter spam/low-quality content

#### 3. Gaming the System
**Problem**: Without accountability
- Users can vote strategically with throwaway identities
- No cost to creating fake identities
- Community can't self-regulate

### Why Traditional Solutions Don't Work

❌ **Proof of Work** (mining) - Too resource intensive for voting app
❌ **Proof of Stake** (cryptocurrency) - Requires tokens, not user-friendly
❌ **Phone/Email Verification** - Centralized, privacy concerns
❌ **Central Authority** - Defeats purpose of decentralized app
✅ **Web of Trust** - Decentralized, social, privacy-preserving

---

## Part 2: Web of Trust Fundamentals

### What is Web of Trust?

**Definition**: A decentralized trust model where users verify each other's identities through personal relationships, creating a graph of trust relationships.

**Origin**: Introduced by PGP (Pretty Good Privacy) in 1992 for email encryption key verification.

### How It Works

```
1. Alice meets Bob in person
2. Alice verifies Bob's identity (checks ID, knows him personally)
3. Alice signs Bob's public key → "I attest that this DID belongs to Bob"
4. Bob does the same for Alice
5. Network builds: Alice → Bob → Carol → Dave
6. Alice trusts Dave through mutual connections (transitive trust)
```

### Trust Levels

**Direct Trust**: You personally verified someone
**Transitive Trust**: Friend-of-friend (2nd degree), friend-of-friend-of-friend (3rd degree)
**Community Trust**: Multiple people attest to someone's identity

---

## Part 3: Architecture Design

### Option 1: Private Trust Lists (Simple)

**Description**: Each user maintains a personal list of trusted DIDs, stored locally or in their profile.

```typescript
interface IdentityProfile {
  displayName?: string;
  avatarUrl?: string;
  publicKey?: string;

  // Private trust list (only visible to owner)
  trustedDids?: string[];     // DIDs I trust
  blockedDids?: string[];     // DIDs I block
}
```

**Pros:**
- ✅ Simple to implement
- ✅ Complete privacy (list not shared)
- ✅ User has full control
- ✅ No additional entities needed

**Cons:**
- ❌ No community reputation
- ❌ Not transitive (can't leverage friend-of-friend)
- ❌ Manual management required
- ❌ No social proof

**Use Case**: Personal content filtering, like email spam filters.

---

### Option 2: Public Trust Attestations (Standard)

**Description**: Trust relationships are first-class entities in the CRDT, publicly visible and signed.

```typescript
interface TrustAttestation {
  id: string;
  trusterDid: string;      // Who is trusting
  trusteeDid: string;      // Who is being trusted
  level: 'verified' | 'endorsed' | 'blocked';
  verificationMethod?: 'in-person' | 'video-call' | 'email' | 'social-proof';
  notes?: string;          // Optional: "Met at conference 2025"
  createdAt: number;
  updatedAt: number;

  // Phase 2: Signature (prevents forgery)
  signature?: string;
}

interface OpinionGraphDoc {
  // ... existing fields
  trustAttestations: Record<string, TrustAttestation>;
}
```

**Pros:**
- ✅ Public transparency
- ✅ Transitive trust calculation possible
- ✅ Community reputation emerges
- ✅ Attestations are signed → tamper-proof

**Cons:**
- ❌ Privacy concerns (trust relationships are public)
- ❌ More complex implementation
- ❌ Storage overhead (~200 bytes per attestation)

**Use Case**: Community-driven platforms where reputation matters.

---

### Option 3: Hybrid Approach (Recommended)

**Description**: Combine private lists for personal filtering + optional public attestations for community reputation.

```typescript
interface IdentityProfile {
  displayName?: string;
  avatarUrl?: string;
  publicKey?: string;

  // Private (local filtering)
  trustedDids?: string[];   // Personal trust list (not synced)
  blockedDids?: string[];   // Personal block list (not synced)
}

interface TrustAttestation {
  id: string;
  trusterDid: string;
  trusteeDid: string;
  level: 'verified' | 'endorsed';  // No 'blocked' (use private list)
  verificationMethod?: string;
  notes?: string;
  createdAt: number;
  signature?: string;
}

interface OpinionGraphDoc {
  // ... existing
  trustAttestations: Record<string, TrustAttestation>;
}
```

**Why Hybrid?**
1. **Private Lists**: For personal preferences (blocking trolls, trusting friends)
2. **Public Attestations**: For strong identity verification (met in person, video call)
3. **Flexibility**: Users choose what to make public

**Decision**: ✅ **Use Hybrid Approach**

---

## Part 4: Trust Calculation

### Trust Levels

```typescript
type TrustLevel =
  | 'verified'    // Direct attestation from trusted user
  | 'trusted'     // 2nd degree (friend-of-friend)
  | 'endorsed'    // 3rd degree (friend-of-friend-of-friend)
  | 'unknown'     // No trust path
  | 'blocked';    // Explicitly blocked
```

### Algorithm: Calculate Trust for a DID

```typescript
function calculateTrustLevel(
  targetDid: string,
  currentUserDid: string,
  doc: OpinionGraphDoc,
  maxDepth: number = 2  // How many hops to search
): TrustLevel {
  // 1. Check personal block list first
  if (doc.identities[currentUserDid]?.blockedDids?.includes(targetDid)) {
    return 'blocked';
  }

  // 2. Check personal trust list
  if (doc.identities[currentUserDid]?.trustedDids?.includes(targetDid)) {
    return 'verified';
  }

  // 3. Check direct public attestations
  const directAttestations = Object.values(doc.trustAttestations).filter(
    a => a.trusterDid === currentUserDid && a.trusteeDid === targetDid
  );
  if (directAttestations.some(a => a.level === 'verified')) {
    return 'verified';
  }

  // 4. Transitive trust (BFS search)
  const trustPath = findTrustPath(currentUserDid, targetDid, doc, maxDepth);
  if (trustPath) {
    if (trustPath.length === 2) return 'trusted';     // 1 hop
    if (trustPath.length === 3) return 'endorsed';    // 2 hops
  }

  // 5. No trust found
  return 'unknown';
}
```

### Breadth-First Search for Trust Path

```typescript
function findTrustPath(
  fromDid: string,
  toDid: string,
  doc: OpinionGraphDoc,
  maxDepth: number
): string[] | null {
  const queue: [string, string[]][] = [[fromDid, [fromDid]]];
  const visited = new Set<string>([fromDid]);

  while (queue.length > 0) {
    const [currentDid, path] = queue.shift()!;

    if (path.length > maxDepth + 1) continue;

    // Get all DIDs trusted by currentDid
    const trustedByCurrentDid = Object.values(doc.trustAttestations)
      .filter(a => a.trusterDid === currentDid && a.level === 'verified')
      .map(a => a.trusteeDid);

    for (const nextDid of trustedByCurrentDid) {
      if (nextDid === toDid) {
        return [...path, nextDid];  // Found path!
      }

      if (!visited.has(nextDid)) {
        visited.add(nextDid);
        queue.push([nextDid, [...path, nextDid]]);
      }
    }
  }

  return null;  // No path found
}
```

---

## Part 5: Schema Design Decisions

### Decision 1: Store Trust Attestations in CRDT? ✅ YES

**Rationale:**
- Enables transitive trust calculations
- Creates transparent reputation system
- Allows community to see trust graph
- Attestations sync across all peers

### Decision 2: Private vs Public Lists? ✅ HYBRID

**Private Lists** (not synced):
- Personal trust/block lists
- For subjective preferences
- No storage overhead in CRDT

**Public Attestations** (synced):
- Strong identity verifications
- For community reputation
- Signed to prevent forgery

### Decision 3: Trust Levels? ✅ THREE LEVELS

**Verified** (direct): You personally verified them
**Trusted** (1 hop): Trusted by someone you trust
**Endorsed** (2 hops): Trusted by someone trusted by someone you trust

**Rationale**: Balance between simplicity and usefulness. More hops = less trustworthy.

### Decision 4: Bi-directional or Uni-directional? ✅ UNI-DIRECTIONAL

**Uni-directional**: A trusts B, but B doesn't have to trust A
**Rationale**: More flexible, mirrors real-world trust (famous person doesn't know all fans)

### Decision 5: Revocation? ✅ UPDATE ATTESTATION

**Revocation**: Update `updatedAt` timestamp, set `level` to something else, or delete
**Rationale**: Automerge tracks history, but clients use latest state

---

## Part 6: Voting Integration

### Filter Votes by Trust Level

```typescript
// In useOpinionGraph.ts

export function getVoteSummaryByTrust(
  assumption: Assumption,
  allVotes: Record<string, Vote>,
  currentUserDid: string,
  doc: OpinionGraphDoc,
  trustFilter: 'all' | 'trusted-only' | 'verified-only'
): VoteSummary {
  // Get all votes
  const assumptionVotes = assumption.voteIds
    .map(id => allVotes[id])
    .filter((v): v is Vote => v !== undefined);

  // Filter by trust level
  const filteredVotes = assumptionVotes.filter(vote => {
    if (trustFilter === 'all') return true;

    const trustLevel = calculateTrustLevel(
      vote.voterDid,
      currentUserDid,
      doc,
      2  // maxDepth
    );

    if (trustFilter === 'verified-only') {
      return trustLevel === 'verified';
    }

    if (trustFilter === 'trusted-only') {
      return trustLevel === 'verified' || trustLevel === 'trusted';
    }

    return false;
  });

  // Compute summary
  return computeVoteSummary(filteredVotes, currentUserDid);
}
```

### UI Toggle

```tsx
// In VoteBar.tsx

function VoteBar({ assumption }: { assumption: Assumption }) {
  const [trustFilter, setTrustFilter] = useState<'all' | 'trusted-only' | 'verified-only'>('all');

  const summaryAll = getVoteSummaryByTrust(assumption, allVotes, currentUserDid, doc, 'all');
  const summary = getVoteSummaryByTrust(assumption, allVotes, currentUserDid, doc, trustFilter);

  return (
    <div className="space-y-2">
      {/* Trust Filter Toggle */}
      <div className="flex gap-2">
        <button
          className={trustFilter === 'all' ? 'active' : ''}
          onClick={() => setTrustFilter('all')}
        >
          All ({summaryAll.total})
        </button>
        <button
          className={trustFilter === 'trusted-only' ? 'active' : ''}
          onClick={() => setTrustFilter('trusted-only')}
        >
          Trusted ({summaryTrusted.total})
        </button>
        <button
          className={trustFilter === 'verified-only' ? 'active' : ''}
          onClick={() => setTrustFilter('verified-only')}
        >
          Verified ({summaryVerified.total})
        </button>
      </div>

      {/* Vote Bars */}
      <VoteChart summary={summary} />
    </div>
  );
}
```

---

## Part 7: UI Components

### Trust Indicator Badge

```tsx
// In components/TrustIndicator.tsx

export function TrustIndicator({ did, doc, currentUserDid }: Props) {
  const trustLevel = calculateTrustLevel(did, currentUserDid, doc, 2);

  const config = {
    verified: { icon: '✓', color: 'green', label: 'Verified' },
    trusted: { icon: '★', color: 'blue', label: 'Trusted' },
    endorsed: { icon: '~', color: 'gray', label: 'Endorsed' },
    unknown: { icon: '?', color: 'gray', label: 'Unknown' },
    blocked: { icon: '✕', color: 'red', label: 'Blocked' },
  };

  const { icon, color, label } = config[trustLevel];

  return (
    <span className={`trust-badge text-${color}-500`} title={label}>
      {icon}
    </span>
  );
}
```

### Trust Management UI

```tsx
// In components/TrustManager.tsx

export function TrustManager({ targetDid }: Props) {
  const { doc, currentUserDid } = useOpinionGraph();
  const [showAttestation, setShowAttestation] = useState(false);

  const trustLevel = calculateTrustLevel(targetDid, currentUserDid, doc, 2);

  const handleAttest = async (level: 'verified' | 'endorsed', method: string) => {
    // Create public attestation
    await createTrustAttestation({
      trusteeDid: targetDid,
      level,
      verificationMethod: method,
    });
  };

  const handleAddToPrivateList = () => {
    // Add to personal trust list (not synced)
    addToPersonalTrustList(targetDid);
  };

  return (
    <div className="trust-manager">
      <h3>Trust {displayName}</h3>
      <p>Current trust level: <TrustIndicator did={targetDid} /></p>

      <div className="actions">
        <button onClick={() => setShowAttestation(true)}>
          Create Public Attestation
        </button>
        <button onClick={handleAddToPrivateList}>
          Add to Personal Trust List
        </button>
      </div>

      {showAttestation && (
        <AttestationModal
          onConfirm={handleAttest}
          onCancel={() => setShowAttestation(false)}
        />
      )}
    </div>
  );
}
```

---

## Part 8: Implementation Phases

### Phase 1: Foundation ✅

- ✅ Real DIDs with Ed25519 keypairs
- ✅ Schema with signature fields
- ✅ Basic identity management

### Phase 2: Signatures ✅

- ✅ JWS signatures for trust attestations
- ✅ Signature verification in UI (green shield icon)
- ✅ Tamper-proof attestations

### Phase 3: Trust Schema ✅

- ✅ `TrustAttestation` entity in schema (`lib/src/schema/identity.ts`)
- ✅ User Document with `trustGiven`/`trustReceived` maps (`lib/src/schema/userDocument.ts`)
- ✅ CRUD operations for trust relationships (`useAppContext` hook)

### Phase 4: Trust Visualization ✅

- ✅ Trust indicators on user avatars (checkmark badges)
- ✅ Signature status badges (valid/invalid/missing)
- ✅ Trust status in profile modals
- ✅ Collaborators/Vertrauensnetzwerk modal

### Phase 5: In-Person Verification ✅

- ✅ QR code generation with DID + userDocUrl
- ✅ QR scanner for verification
- ✅ Bidirectional trust sync via userDocUrl

### Phase 6: Security Features ✅

- ✅ Real-time signature validation on trustReceived changes
- ✅ Automatic cleanup of invalid attestations
- ✅ Bidirectional revocation sync

### Phase 7: Trust Management UI ✅

- ✅ Profile modal with trust actions
- ✅ Reciprocity modal for pending trust requests
- ✅ Signature badges everywhere trust is displayed

### Remaining (Future)

- ⏳ Transitive trust calculation (friend-of-friend)
- ⏳ Filter votes by trust level
- ⏳ Trust graph visualization
- ⏳ Trust depth settings

---

## Part 9: Open Questions & Challenges

### 1. Bootstrap Problem
**Problem**: New users have 0 trust → all content filtered out
**Solutions:**
- Default to "show all" for new users
- Provide seed trust (e.g., project founders)
- Progressive trust (start with wide filter, tighten over time)

**Decision**: Default to "all", let users tighten filters as they build trust

### 2. Privacy vs Transparency
**Problem**: Public attestations reveal relationships
**Solutions:**
- Hybrid model (private + public)
- Opt-in public attestations
- Anonymous attestations (advanced)

**Decision**: Hybrid model with user choice

### 3. Trust Revocation
**Problem**: What if someone becomes untrustworthy?
**Solutions:**
- Update attestation to `blocked`
- Delete attestation
- Attestations have `updatedAt` timestamp

**Decision**: Update attestation, clients use latest state

### 4. Sybil Resistance
**Problem**: Attacker creates 100 DIDs, all attest to each other
**Solutions:**
- Transitive trust only from YOUR trusted DIDs
- Limit trust depth (2 hops max)
- Reputation decay over time

**Decision**: Trust path must originate from YOUR direct trust

### 5. Performance
**Problem**: Trust calculation on every vote render?
**Solutions:**
- Cache trust levels in React state
- Memoize calculations with `useMemo`
- Pre-calculate trust graph

**Decision**: Use `useMemo` with doc hash as dependency

### 6. Gaming the System
**Problem**: Users trade attestations ("I'll verify you if you verify me")
**Solutions:**
- Social norms (community guidelines)
- Reputation scores (multiple attestations = more trustworthy)
- UI warnings ("only attest to people you know")

**Decision**: Rely on social norms + UI guidance

---

## Part 10: Comparison with Alternatives

### vs. Proof of Work
❌ Too resource-intensive
❌ Doesn't scale for voting app
✅ Web of Trust: Social, no compute needed

### vs. Phone/Email Verification
❌ Centralized service
❌ Privacy concerns
❌ Can be gamed (buy phone numbers)
✅ Web of Trust: Decentralized, privacy-preserving

### vs. Proof of Humanity (Biometrics)
❌ Expensive to implement
❌ Serious privacy concerns
❌ Accessibility issues
✅ Web of Trust: Simple, social, accessible

### vs. Token Staking
❌ Requires cryptocurrency
❌ Pay-to-play model
❌ Excludes users without funds
✅ Web of Trust: Free, inclusive

---

## Part 11: Final Architecture Summary

### Schema

```typescript
// Trust attestation entity
interface TrustAttestation {
  id: string;
  trusterDid: string;
  trusteeDid: string;
  level: 'verified' | 'endorsed';
  verificationMethod?: 'in-person' | 'video-call' | 'email' | 'social-proof';
  notes?: string;
  createdAt: number;
  updatedAt: number;
  signature?: string;  // Phase 2
}

// Private trust lists
interface IdentityProfile {
  displayName?: string;
  avatarUrl?: string;
  publicKey?: string;
  trustedDids?: string[];   // Not synced
  blockedDids?: string[];   // Not synced
}

// Add to OpinionGraphDoc
interface OpinionGraphDoc {
  // ... existing fields
  trustAttestations: Record<string, TrustAttestation>;
}
```

### Core Functions

```typescript
// Calculate trust level for a DID
function calculateTrustLevel(
  targetDid: string,
  currentUserDid: string,
  doc: OpinionGraphDoc,
  maxDepth: number = 2
): TrustLevel;

// Find trust path between two DIDs
function findTrustPath(
  fromDid: string,
  toDid: string,
  doc: OpinionGraphDoc,
  maxDepth: number
): string[] | null;

// Filter votes by trust
function getVoteSummaryByTrust(
  assumption: Assumption,
  allVotes: Record<string, Vote>,
  currentUserDid: string,
  doc: OpinionGraphDoc,
  trustFilter: 'all' | 'trusted-only' | 'verified-only'
): VoteSummary;
```

### UI Components

- `TrustIndicator`: Badge showing trust level
- `TrustManager`: UI for creating attestations
- `VoteBar` with trust filter toggle
- Trust graph visualization (future)

---

## Part 12: Current Implementation Details

### Key Files

| File | Purpose |
|------|---------|
| `lib/src/schema/identity.ts` | `TrustAttestation` interface |
| `lib/src/schema/userDocument.ts` | `UserDocument` with `trustGiven`/`trustReceived` |
| `lib/src/hooks/useAppContext.ts` | Trust operations, signature validation |
| `lib/src/components/UserProfileModal.tsx` | Profile with trust status + QR code |
| `lib/src/components/QRScannerModal.tsx` | QR scanner for verification |
| `lib/src/components/TrustReciprocityModal.tsx` | Pending trust requests |
| `lib/src/components/UserListItem.tsx` | User list with trust badges |
| `lib/src/components/CollaboratorsModal.tsx` | Trust network view |
| `lib/src/utils/signature.ts` | JWS signing/verification |

### Trust Flow

1. **Creating Trust (QR Verification)**

   ```text
   User A shows QR → User B scans → B trusts A
   QR contains: narrative://verify/{did}?userDoc={url}
   ```

2. **Bidirectional Trust Sync**

   ```text
   When B trusts A:
   1. B writes to B.userDoc.trustGiven[A.did] (signed by B)
   2. B writes to A.userDoc.trustReceived[B.did] (signed by B)
   ```

3. **Signature Validation**

   ```text
   On every trustReceived change:
   1. Verify signature against trusterDid's public key
   2. Delete invalid entries automatically
   ```

4. **Trust Revocation**

   ```text
   When B revokes trust of A:
   1. B removes B.userDoc.trustGiven[A.did]
   2. B removes A.userDoc.trustReceived[B.did]
   ```

### Signature Status Types

| Status | Icon | Meaning |
|--------|------|---------|
| `valid` | 🛡️ (green) | Signature verified successfully |
| `invalid` | ⚠️ (red) | Signature verification failed - possibly forged! |
| `missing` | ❓ (gray) | No signature (legacy attestation) |
| `pending` | ⏳ (spinner) | Verification in progress |

### Security Model

- **Anyone can write** to any Automerge document (CRDT limitation)
- **Protection via signatures**: Invalid signatures are ignored/deleted at read time
- **Continuous validation**: `trustReceived` is validated on every change, not just on load
- **Automatic cleanup**: Invalid attestations are silently removed

---

## Part 13: Next Steps

1. **Transitive Trust** (Future)
   - Implement `calculateTrustLevel()` with BFS
   - Add friend-of-friend trust indicators
   - Trust depth configuration

2. **Voting Integration** (Future)
   - Filter votes by trust level
   - Show trust-filtered vote summaries
   - UI toggle for trust filters

3. **Trust Graph Visualization** (Future)
   - Visual representation of trust network
   - Path visualization between users

4. **Tests**
   - Unit tests for signature verification
   - Integration tests for trust flow
   - E2E tests for QR scanning

---

## References

- **PGP Web of Trust**: https://en.wikipedia.org/wiki/Web_of_trust
- **Sybil Attack**: https://en.wikipedia.org/wiki/Sybil_attack
- **OpenPGP Best Practices**: https://help.riseup.net/en/security/message-security/openpgp/best-practices
- **Trust Graph Algorithms**: https://en.wikipedia.org/wiki/Betweenness_centrality
- **Identity and Trust in SSI**: https://www.w3.org/TR/vc-data-model/
