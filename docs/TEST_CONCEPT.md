# Test-Konzept für Narrative

> **Version**: 1.0
> **Datum**: 2025-12-02
> **Status**: Entwurf

## Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Test-Pyramide](#test-pyramide)
3. [Test-Ebenen](#test-ebenen)
4. [CRDT-Spezifische Tests](#crdt-spezifische-tests)
5. [Test-Infrastruktur](#test-infrastruktur)
6. [Implementierungs-Roadmap](#implementierungs-roadmap)
7. [Konventionen & Best Practices](#konventionen--best-practices)
8. [Metriken & Ziele](#metriken--ziele)

---

## Übersicht

Narrative ist eine **local-first Assumption-Tracking-App** mit folgenden technischen Besonderheiten:

- **CRDTs** (Automerge) für konfliktfreie Datensynchronisation
- **Offline-first** Architektur mit IndexedDB-Persistierung
- **Peer-to-peer Sync** ohne zentralen Server
- **Monorepo-Struktur** (lib + app)

Diese Besonderheiten erfordern eine angepasste Test-Strategie mit Fokus auf:

1. **CRDT-Konfliktauflösung** (Concurrent Edits, Merge-Verhalten)
2. **Datenintegrität** (Schema-Validierung, ID-Eindeutigkeit)
3. **Offline/Online-Szenarien** (Sync, Storage, Recovery)

**Aktueller Status**: Keine Tests vorhanden. Vitest ist in `lib/package.json` konfiguriert, aber nicht genutzt.

---

## Test-Pyramide

Aufgrund der CRDT-basierten Architektur empfehlen wir folgende Verteilung:

```
           E2E Tests (5%)
         ─────────────────
       Integration Tests (25%)
     ───────────────────────────
         Unit Tests (70%)
   ──────────────────────────────
```

### Begründung

- **70% Unit Tests**: CRDTs erfordern umfangreiche Tests für Mutations-Korrektheit, Array-Operationen und Datenintegrität
- **25% Integration Tests**: Multi-Peer-Sync, Conflict Resolution, Storage-Integration
- **5% E2E Tests**: Local-first Architektur macht klassische E2E-Tests weniger kritisch; Fokus auf kritische User Journeys

---

## Test-Ebenen

### 1. Unit Tests (Library)

**Priorität**: 🔴 **HÖCHSTE**

#### 1.1 Schema Tests

**Datei**: `lib/src/schema/index.test.ts`

**Zu testende Funktionen**:

| Funktion | Test-Szenarien | Kritisch |
|----------|----------------|----------|
| `createEmptyDoc()` | - Korrekte Struktur<br>- Alle required fields vorhanden<br>- Initialisierung von Maps/Arrays | ⚠️ JA |
| `generateId()` | - Eindeutigkeit (10.000 IDs)<br>- Format-Validierung<br>- Keine Kollisionen | ⚠️ JA |
| `computeVoteSummary()` | - Leere Vote-Liste → {0,0,0}<br>- Gemischte Votes → korrekte Zählung<br>- Edge Cases: nur ein Vote-Typ | ⚠️ JA |

**Beispiel-Test**:

```typescript
import { describe, it, expect } from 'vitest';
import { generateId, computeVoteSummary } from './index';

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 10000 }, () => generateId()));
    expect(ids.size).toBe(10000);
  });

  it('should match expected format', () => {
    const id = generateId();
    expect(id).toMatch(/^[a-zA-Z0-9_-]{21}$/); // nanoid format
  });
});

describe('computeVoteSummary', () => {
  it('should return zeros for empty vote list', () => {
    expect(computeVoteSummary([])).toEqual({
      agree: 0,
      neutral: 0,
      disagree: 0,
    });
  });

  it('should count votes correctly', () => {
    const votes = [
      { id: '1', userId: 'u1', type: 'agree' as const, timestamp: 0, userName: '' },
      { id: '2', userId: 'u2', type: 'disagree' as const, timestamp: 0, userName: '' },
      { id: '3', userId: 'u3', type: 'agree' as const, timestamp: 0, userName: '' },
    ];
    expect(computeVoteSummary(votes)).toEqual({
      agree: 2,
      neutral: 0,
      disagree: 1,
    });
  });
});
```

#### 1.2 Hook Tests (useOpinionGraph)

**Datei**: `lib/src/hooks/useOpinionGraph.test.tsx`

**Kritische Test-Kategorien**:

##### A) CRDT Mutation Korrektheit

| Funktion | Test-Szenarien |
|----------|----------------|
| `createAssumption()` | - Assumption wird korrekt in `doc.assumptions` eingefügt<br>- `lastModified` wird aktualisiert<br>- Keine Seiteneffekte auf andere Assumptions |
| `updateAssumption()` | - **Nur minimale Array-Änderungen** (kein Replace!)<br>- Text-Update funktioniert<br>- Tag-Hinzufügen: nur neue Tags pushen<br>- Tag-Entfernen: nur entfernte Tags splicing |
| `deleteAssumption()` | - Assumption wird gelöscht<br>- Zugehörige Votes werden gelöscht<br>- Tags bleiben erhalten (wenn in anderen Assumptions verwendet) |
| `setVote()` | - Vote wird erstellt<br>- Existierender Vote wird ersetzt (1 Vote pro User)<br>- Vote wird zu `assumption.voteIds` hinzugefügt |
| `removeVote()` | - Vote wird aus `doc.votes` gelöscht<br>- Vote-ID wird aus `assumption.voteIds` entfernt |

##### B) CRDT Anti-Patterns (sicherstellen, dass sie NICHT auftreten)

```typescript
describe('CRDT mutation safety', () => {
  it('should NOT replace entire tagIds array', () => {
    const { handle } = createTestDoc();
    const assumption = createAssumption('Test');

    // Füge Assumption mit Tags hinzu
    handle.change(d => {
      d.assumptions[assumption.id] = assumption;
      d.assumptions[assumption.id].tagIds = ['tag1', 'tag2'];
    });

    // Update mit neuem Tag-Set
    const newTags = ['tag2', 'tag3'];
    updateAssumption(handle, assumption.id, { tagIds: newTags });

    const doc = handle.docSync();
    // Verifiziere, dass nur minimale Änderungen gemacht wurden
    expect(doc.assumptions[assumption.id].tagIds).toEqual(['tag2', 'tag3']);

    // WICHTIG: Teste mit Automerge History, dass kein Array-Replace stattfand
  });
});
```

##### C) Concurrent Edit Simulation

```typescript
describe('concurrent edits', () => {
  it('should handle concurrent tag additions from two peers', async () => {
    const repo1 = createTestRepo();
    const repo2 = createTestRepo();

    // Setup: beide Repos sehen dasselbe Dokument
    const handle1 = repo1.create<OpinionGraphDoc>();
    handle1.change(d => Object.assign(d, createEmptyDoc()));

    const docUrl = handle1.url;
    const handle2 = repo2.find<OpinionGraphDoc>(docUrl);

    await waitForSync(handle1, handle2);

    // Peer 1 fügt Tag hinzu
    handle1.change(d => {
      d.assumptions['a1'].tagIds.push('tag1');
    });

    // Peer 2 fügt gleichzeitig anderen Tag hinzu
    handle2.change(d => {
      d.assumptions['a1'].tagIds.push('tag2');
    });

    // Warte auf Sync
    await waitForSync(handle1, handle2);

    // Beide Tags sollten vorhanden sein
    const doc1 = handle1.docSync();
    const doc2 = handle2.docSync();

    expect(doc1.assumptions['a1'].tagIds).toHaveLength(2);
    expect(doc2.assumptions['a1'].tagIds).toHaveLength(2);
    expect(doc1.assumptions['a1'].tagIds).toEqual(doc2.assumptions['a1'].tagIds);
  });
});
```

##### D) Identity Management

```typescript
describe('updateIdentity', () => {
  it('should update display name in doc.identities', () => {
    const { handle } = createTestDoc();
    const did = 'did:key:test123';

    updateIdentity(handle, did, 'New Name');

    const doc = handle.docSync();
    expect(doc.identities[did].displayName).toBe('New Name');
  });

  it('should propagate name to existing votes', () => {
    const { handle } = createTestDoc();
    const did = 'did:key:test123';

    // Erstelle Vote mit altem Namen
    handle.change(d => {
      d.votes['v1'] = {
        id: 'v1',
        userId: did,
        userName: 'Old Name',
        type: 'agree',
        timestamp: Date.now(),
      };
    });

    // Update Identity
    updateIdentity(handle, did, 'New Name');

    const doc = handle.docSync();
    expect(doc.votes['v1'].userName).toBe('New Name');
  });
});
```

#### 1.3 DID Utils Tests

**Datei**: `lib/src/utils/did.test.ts`

**Zu testen**:

- `generateDID()` - Format, Eindeutigkeit
- `generateKeypair()` - Gültige Keypair-Generierung
- Signature-Funktionen (falls implementiert)

**Beispiel**:

```typescript
describe('generateDID', () => {
  it('should generate DID with correct format', () => {
    const did = generateDID();
    expect(did).toMatch(/^did:key:[a-zA-Z0-9_-]+$/);
  });

  it('should generate unique DIDs', () => {
    const dids = new Set(Array.from({ length: 1000 }, () => generateDID()));
    expect(dids.size).toBe(1000);
  });
});
```

---

### 2. Integration Tests (Library)

**Priorität**: 🟡 **MITTEL-HOCH**

#### 2.1 Multi-Peer Sync Tests

**Datei**: `lib/src/__tests__/integration/multi-peer-sync.test.ts`

**Szenarien**:

1. **Assumption Sync zwischen zwei Repos**
2. **Vote Propagation**
3. **Delete Propagation**
4. **Conflict Resolution bei concurrent Creates**

**Setup-Pattern**:

```typescript
import { Repo } from '@automerge/automerge-repo';
import { DummyStorageAdapter } from '@automerge/automerge-repo/helpers/DummyStorageAdapter';

function createConnectedRepos() {
  const repo1 = new Repo({ storage: new DummyStorageAdapter() });
  const repo2 = new Repo({ storage: new DummyStorageAdapter() });

  // Setup Netzwerk-Verbindung zwischen Repos
  // (z.B. MessageChannelNetworkAdapter für Tests)

  return { repo1, repo2 };
}
```

#### 2.2 Edit History Tests

**Datei**: `lib/src/__tests__/integration/edit-history.test.ts`

**Szenarien**:

- Assumption mehrfach editieren → korrekte `editLogIds` Reihenfolge
- Edit History nach Merge von zwei Peers
- Edge Case: Edit während Delete

---

### 3. Component Tests (App)

**Priorität**: 🟢 **MITTEL**

#### 3.1 Setup

**Erforderliche Dependencies**:

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@testing-library/jest-dom": "^6.0.0",
    "happy-dom": "^12.0.0"
  }
}
```

**Vitest Config**: `app/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/__tests__/setup.ts',
  },
});
```

**Setup File**: `app/src/__tests__/setup.ts`

```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

#### 3.2 Component Test Files

| Komponente | Test-Datei | Priorität |
|------------|------------|-----------|
| AssumptionCard | `app/src/components/AssumptionCard.test.tsx` | HOCH |
| VoteBar | `app/src/components/VoteBar.test.tsx` | HOCH |
| AssumptionList | `app/src/components/AssumptionList.test.tsx` | MITTEL |
| CreateAssumptionModal | `app/src/components/CreateAssumptionModal.test.tsx` | MITTEL |
| MainView | `app/src/components/MainView.test.tsx` | NIEDRIG |

**Beispiel (AssumptionCard)**:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AssumptionCard } from './AssumptionCard';

describe('AssumptionCard', () => {
  const mockAssumption = {
    id: 'a1',
    sentence: 'Test assumption',
    tagIds: [],
    voteIds: [],
    timestamp: Date.now(),
    author: 'did:key:test',
    authorName: 'Test User',
    editLogIds: [],
  };

  it('should display assumption sentence', () => {
    render(<AssumptionCard assumption={mockAssumption} />);
    expect(screen.getByText('Test assumption')).toBeInTheDocument();
  });

  it('should call onVote when agree button clicked', async () => {
    const onVote = vi.fn();
    render(<AssumptionCard assumption={mockAssumption} onVote={onVote} />);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Agree'));

    expect(onVote).toHaveBeenCalledWith('agree');
  });

  it('should display vote summary', () => {
    const withVotes = {
      ...mockAssumption,
      votes: [
        { type: 'agree', userId: 'u1' },
        { type: 'agree', userId: 'u2' },
        { type: 'disagree', userId: 'u3' },
      ],
    };

    render(<AssumptionCard assumption={withVotes} />);
    // Verifiziere VoteBar Anzeige
  });
});
```

---

### 4. E2E Tests

**Priorität**: ⚪ **NIEDRIG** (erst nach solider Unit/Integration-Abdeckung)

#### 4.1 Tool-Wahl

**Empfehlung**: Playwright

**Begründung**:
- Multi-Browser Support (wichtig für Sync-Tests)
- Parallelisierung
- Auto-Waiting & Retry-Logic
- Bessere DX als Cypress für local-first Apps

#### 4.2 Kritische User Journeys

**Datei**: `app/e2e/collaboration.spec.ts`

**Szenarien**:

1. **New Board Creation**:
   ```typescript
   test('should create new board and add assumption', async ({ page }) => {
     await page.goto('http://localhost:3000');
     await page.click('button:has-text("New Board")');

     // Warte auf neue URL
     await expect(page).toHaveURL(/#doc=automerge:/);

     // Erstelle Assumption
     await page.fill('textarea[placeholder*="assumption"]', 'My first assumption');
     await page.click('button:has-text("Create")');

     // Verifiziere
     await expect(page.locator('text=My first assumption')).toBeVisible();
   });
   ```

2. **Cross-Browser Sync**:
   ```typescript
   test('should sync assumptions between two browsers', async ({ browser }) => {
     const context1 = await browser.newContext();
     const context2 = await browser.newContext();

     const page1 = await context1.newPage();
     const page2 = await context2.newPage();

     // Browser 1 erstellt Board
     await page1.goto('http://localhost:3000');
     // ... erstelle Assumption

     const url = await page1.url();

     // Browser 2 öffnet dieselbe URL
     await page2.goto(url);

     // Warte auf Sync
     await page2.waitForTimeout(2000);

     // Beide sehen dieselbe Assumption
     await expect(page1.locator('text=Test')).toBeVisible();
     await expect(page2.locator('text=Test')).toBeVisible();
   });
   ```

3. **Offline Behavior**:
   ```typescript
   test('should work offline and sync when online', async ({ page, context }) => {
     await page.goto('http://localhost:3000');

     // Erstelle Assumption online
     await page.fill('textarea', 'Online assumption');
     await page.click('button:has-text("Create")');

     // Gehe offline
     await context.setOffline(true);

     // Erstelle Assumption offline
     await page.fill('textarea', 'Offline assumption');
     await page.click('button:has-text("Create")');

     // Beide sollten sichtbar sein (local)
     await expect(page.locator('text=Online assumption')).toBeVisible();
     await expect(page.locator('text=Offline assumption')).toBeVisible();

     // Gehe online
     await context.setOffline(false);

     // Warte auf Sync (visuelles Feedback prüfen)
   });
   ```

---

## CRDT-Spezifische Tests

**Priorität**: 🔴 **HÖCHSTE** (einzigartig für dieses Projekt)

### Warum kritisch?

Automerge CRDTs haben spezifische Regeln, die bei Missachtung zu **Dateninkonsistenzen** führen:

1. ❌ **NIEMALS Arrays/Objects ersetzen** → Verwende granulare Operationen
2. ❌ **NIEMALS `undefined` zuweisen** → Verwende `delete`
3. ✅ **IMMER innerhalb von `.change()` mutieren**

### Test-Kategorien

#### 1. Array Operation Safety

**Datei**: `lib/src/__tests__/crdt/array-operations.test.ts`

**Ziel**: Sicherstellen, dass KEINE Array-Replacements stattfinden

```typescript
describe('Array operations safety', () => {
  it('should not replace tagIds array when updating', () => {
    const { handle } = createTestDoc();

    // Initial state
    handle.change(d => {
      d.assumptions['a1'] = {
        id: 'a1',
        sentence: 'Test',
        tagIds: ['tag1', 'tag2'],
        // ...
      };
    });

    // Capture Automerge history length
    const historyBefore = Automerge.getHistory(handle.docSync()).length;

    // Update: remove tag1, add tag3
    updateAssumption(handle, 'a1', { tagIds: ['tag2', 'tag3'] });

    // Verifiziere Ergebnis
    const doc = handle.docSync();
    expect(doc.assumptions['a1'].tagIds).toEqual(['tag2', 'tag3']);

    // KRITISCH: Verifiziere, dass nur 2 Operationen gemacht wurden (splice + push)
    // NICHT 1 Operation (array replacement)
    const historyAfter = Automerge.getHistory(handle.docSync()).length;
    const operations = historyAfter - historyBefore;

    // Exakte Zahl hängt von Implementation ab, aber sollte > 1 sein
    expect(operations).toBeGreaterThan(1);
  });
});
```

#### 2. Concurrent Edit Resolution

**Datei**: `lib/src/__tests__/crdt/conflict-resolution.test.ts`

**Szenarien**:

```typescript
describe('Concurrent edits', () => {
  it('should preserve both assumptions when created with same ID', () => {
    const base = Automerge.from(createEmptyDoc());

    const doc1 = Automerge.change(base, d => {
      d.assumptions['a1'] = createAssumption('First');
    });

    const doc2 = Automerge.change(base, d => {
      d.assumptions['a1'] = createAssumption('Second');
    });

    const merged = Automerge.merge(doc1, doc2);

    // Automerge wählt einen Gewinner (last-write-wins per ID)
    // Wichtig: kein Data Loss, aber nur eine bleibt
    expect(Object.keys(merged.assumptions)).toContain('a1');
  });

  it('should merge concurrent tag additions', () => {
    const base = Automerge.from(createEmptyDoc());
    base.assumptions['a1'] = createAssumption('Test');
    base.assumptions['a1'].tagIds = [];

    const doc1 = Automerge.change(base, d => {
      d.assumptions['a1'].tagIds.push('tag1');
    });

    const doc2 = Automerge.change(base, d => {
      d.assumptions['a1'].tagIds.push('tag2');
    });

    const merged = Automerge.merge(doc1, doc2);

    // Beide Tags sollten vorhanden sein
    expect(merged.assumptions['a1'].tagIds).toHaveLength(2);
    expect(merged.assumptions['a1'].tagIds).toContain('tag1');
    expect(merged.assumptions['a1'].tagIds).toContain('tag2');
  });

  it('should handle concurrent vote changes (last-write-wins)', () => {
    const base = Automerge.from(createEmptyDoc());
    const userId = 'did:key:test';

    // User voted "agree"
    base.votes['v1'] = {
      id: 'v1',
      userId,
      type: 'agree',
      timestamp: 1000,
      userName: 'Test',
    };

    // Concurrent changes: User changes to "disagree" offline on two devices
    const doc1 = Automerge.change(base, d => {
      d.votes['v1'].type = 'disagree';
      d.votes['v1'].timestamp = 2000;
    });

    const doc2 = Automerge.change(base, d => {
      d.votes['v1'].type = 'neutral';
      d.votes['v1'].timestamp = 2001;
    });

    const merged = Automerge.merge(doc1, doc2);

    // Automerge wählt einen Gewinner (typischerweise höherer Timestamp)
    expect(merged.votes['v1'].type).toBe('neutral');
  });
});
```

#### 3. Delete Edge Cases

```typescript
describe('Delete operations', () => {
  it('should handle delete during concurrent edit', () => {
    const base = Automerge.from(createEmptyDoc());
    base.assumptions['a1'] = createAssumption('Test');

    // Peer 1 deletes assumption
    const doc1 = Automerge.change(base, d => {
      delete d.assumptions['a1'];
    });

    // Peer 2 edits assumption
    const doc2 = Automerge.change(base, d => {
      d.assumptions['a1'].sentence = 'Updated';
    });

    const merged = Automerge.merge(doc1, doc2);

    // Delete gewinnt (typisches CRDT-Verhalten)
    expect(merged.assumptions['a1']).toBeUndefined();
  });
});
```

---

## Test-Infrastruktur

### 1. Vitest Konfiguration

#### Library Config

**Datei**: `lib/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

#### App Config

**Datei**: `app/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/__tests__/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/__tests__/**',
        'src/main.tsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
});
```

### 2. Test Helpers

**Datei**: `lib/src/__tests__/helpers.ts`

```typescript
import { Repo } from '@automerge/automerge-repo';
import { DummyStorageAdapter } from '@automerge/automerge-repo/helpers/DummyStorageAdapter';
import * as Automerge from '@automerge/automerge';
import type { OpinionGraphDoc } from '../schema';
import { createEmptyDoc } from '../schema';

export function createTestRepo(): Repo {
  return new Repo({
    storage: new DummyStorageAdapter(),
  });
}

export function createTestDoc() {
  const repo = createTestRepo();
  const handle = repo.create<OpinionGraphDoc>();
  handle.change(d => Object.assign(d, createEmptyDoc()));
  return { repo, handle };
}

export function createMockAssumption(overrides?: Partial<Assumption>): Assumption {
  return {
    id: generateId(),
    sentence: 'Test assumption',
    tagIds: [],
    voteIds: [],
    timestamp: Date.now(),
    author: 'did:key:test',
    authorName: 'Test User',
    editLogIds: [],
    ...overrides,
  };
}

export function createMockVote(overrides?: Partial<Vote>): Vote {
  return {
    id: generateId(),
    userId: 'did:key:test',
    userName: 'Test User',
    type: 'agree',
    timestamp: Date.now(),
    ...overrides,
  };
}

export async function waitForSync(
  handle1: DocHandle<any>,
  handle2: DocHandle<any>,
  timeout = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Sync timeout')), timeout);

    // Warte bis beide Dokumente identische Heads haben
    const checkSync = () => {
      const heads1 = Automerge.getHeads(handle1.docSync());
      const heads2 = Automerge.getHeads(handle2.docSync());

      if (JSON.stringify(heads1) === JSON.stringify(heads2)) {
        clearTimeout(timer);
        resolve();
      } else {
        setTimeout(checkSync, 100);
      }
    };

    checkSync();
  });
}
```

### 3. Mock Data

**Datei**: `lib/src/__tests__/fixtures.ts`

```typescript
import type { OpinionGraphDoc, Assumption, Vote, Tag } from '../schema';

export const mockAssumptions: Record<string, Assumption> = {
  a1: {
    id: 'a1',
    sentence: 'React is better than Vue',
    tagIds: ['t1', 't2'],
    voteIds: ['v1', 'v2'],
    timestamp: 1700000000000,
    author: 'did:key:user1',
    authorName: 'Alice',
    editLogIds: [],
  },
  a2: {
    id: 'a2',
    sentence: 'TypeScript improves code quality',
    tagIds: ['t2'],
    voteIds: ['v3'],
    timestamp: 1700001000000,
    author: 'did:key:user2',
    authorName: 'Bob',
    editLogIds: [],
  },
};

export const mockVotes: Record<string, Vote> = {
  v1: {
    id: 'v1',
    userId: 'did:key:user1',
    userName: 'Alice',
    type: 'agree',
    timestamp: 1700000000000,
  },
  v2: {
    id: 'v2',
    userId: 'did:key:user2',
    userName: 'Bob',
    type: 'disagree',
    timestamp: 1700000100000,
  },
  v3: {
    id: 'v3',
    userId: 'did:key:user3',
    userName: 'Charlie',
    type: 'agree',
    timestamp: 1700001000000,
  },
};

export const mockTags: Record<string, Tag> = {
  t1: {
    id: 't1',
    name: 'Frontend',
    color: '#3b82f6',
    timestamp: 1700000000000,
  },
  t2: {
    id: 't2',
    name: 'Opinion',
    color: '#8b5cf6',
    timestamp: 1700000000000,
  },
};

export function createMockDoc(overrides?: Partial<OpinionGraphDoc>): OpinionGraphDoc {
  return {
    identity: {
      did: 'did:key:test',
      displayName: 'Test User',
    },
    identities: {
      'did:key:user1': { displayName: 'Alice' },
      'did:key:user2': { displayName: 'Bob' },
    },
    assumptions: mockAssumptions,
    votes: mockVotes,
    tags: mockTags,
    edits: {},
    version: '1.0.0',
    lastModified: Date.now(),
    ...overrides,
  };
}
```

### 4. CI/CD Integration

**Datei**: `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Build library
        run: npm run build:lib

      - name: Run library tests
        run: npm run test --workspace=lib

      - name: Run app tests
        run: npm run test --workspace=app

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./lib/coverage/lcov.info,./app/coverage/lcov.info
          flags: unittests
          name: codecov-narrative
```

---

## Implementierungs-Roadmap

### Phase 1: Fundament (Woche 1-2)

**Ziel**: Test-Infrastruktur aufbauen & kritische Schema-Tests

**Tasks**:
- [ ] Vitest Config für `lib/` und `app/` erstellen
- [ ] Test-Helpers (`lib/src/__tests__/helpers.ts`) implementieren
- [ ] Mock-Daten (`lib/src/__tests__/fixtures.ts`) erstellen
- [ ] Schema Unit Tests:
  - [ ] `generateId()` - Eindeutigkeit, Format
  - [ ] `computeVoteSummary()` - Alle Edge Cases
  - [ ] `createEmptyDoc()` - Struktur-Validierung
- [ ] DID Utils Tests (`lib/src/utils/did.test.ts`)
- [ ] CI/CD Workflow (`.github/workflows/test.yml`)

**Deliverable**: ~50% Coverage in `lib/src/schema/` und `lib/src/utils/`

---

### Phase 2: Kern-Logik (Woche 3-4)

**Ziel**: Hook-Funktionen & CRDT-Sicherheit

**Tasks**:
- [ ] Hook Tests (`lib/src/hooks/useOpinionGraph.test.tsx`):
  - [ ] Alle CRUD-Funktionen (create, update, delete, setVote, removeVote)
  - [ ] Identity Management (`updateIdentity`)
- [ ] CRDT Array Operation Safety Tests
- [ ] CRDT Conflict Resolution Tests (Basic)
- [ ] Component Unit Tests (Priorität):
  - [ ] `AssumptionCard.test.tsx`
  - [ ] `VoteBar.test.tsx`

**Deliverable**: ~80% Coverage in `lib/src/hooks/`, ~60% in `app/src/components/`

---

### Phase 3: Integration (Woche 5-6)

**Ziel**: Multi-Peer Sync & Storage

**Tasks**:
- [ ] Multi-Repo Sync Tests (`lib/src/__tests__/integration/multi-peer-sync.test.ts`)
- [ ] Edit History Tests (`lib/src/__tests__/integration/edit-history.test.ts`)
- [ ] Storage Tests (IndexedDB, localStorage)
- [ ] Erweiterte Conflict Resolution Tests
- [ ] Restliche Component Tests:
  - [ ] `AssumptionList.test.tsx`
  - [ ] `CreateAssumptionModal.test.tsx`

**Deliverable**: Integration Tests laufen stabil, 75%+ Gesamt-Coverage

---

### Phase 4: E2E & Polish (Woche 7+)

**Ziel**: User Journeys & Coverage-Optimierung

**Tasks**:
- [ ] Playwright Setup & Config
- [ ] E2E Tests für kritische Journeys:
  - [ ] New Board Creation
  - [ ] Cross-Browser Sync
  - [ ] Offline Behavior
- [ ] Coverage auf 80%+ bringen (Lücken schließen)
- [ ] Performance Tests (optional)
- [ ] Dokumentation finalisieren

**Deliverable**: Production-ready Test-Suite

---

## Konventionen & Best Practices

### Datei-Organisation

```
lib/
├── src/
│   ├── schema/
│   │   ├── index.ts
│   │   └── index.test.ts          # Co-located tests
│   ├── hooks/
│   │   ├── useOpinionGraph.ts
│   │   └── useOpinionGraph.test.tsx
│   ├── utils/
│   │   ├── did.ts
│   │   └── did.test.ts
│   └── __tests__/
│       ├── helpers.ts             # Shared test utilities
│       ├── fixtures.ts            # Mock data
│       ├── integration/           # Integration tests
│       │   ├── multi-peer-sync.test.ts
│       │   └── edit-history.test.ts
│       └── crdt/                  # CRDT-specific tests
│           ├── array-operations.test.ts
│           └── conflict-resolution.test.ts

app/
├── src/
│   ├── components/
│   │   ├── AssumptionCard.tsx
│   │   └── AssumptionCard.test.tsx  # Co-located
│   └── __tests__/
│       ├── setup.ts                 # Test setup
│       └── integration/
│           └── opinion-graph-integration.test.tsx
```

### Naming Conventions

- Test-Dateien: `*.test.ts` / `*.test.tsx`
- Test Suites: `describe('ComponentName', () => {})`
- Tests: `it('should do something', () => {})`
- Helper Functions: `createTestX()`, `mockX()`

### Assertions

**Bevorzuge spezifische Matchers**:

```typescript
// ❌ Vermeiden
expect(result).toBe(true);

// ✅ Besser
expect(result).toBeTruthy();

// ✅ Noch besser (wenn verfügbar)
expect(element).toBeInTheDocument();
```

### CRDT Test Patterns

**Pattern 1: Mutation Testing**

```typescript
it('should mutate document correctly', () => {
  const { handle } = createTestDoc();

  // Before
  const before = handle.docSync();
  expect(before.assumptions).toEqual({});

  // Action
  createAssumption(handle, 'Test');

  // After
  const after = handle.docSync();
  expect(Object.keys(after.assumptions)).toHaveLength(1);
});
```

**Pattern 2: Concurrent Edit Testing**

```typescript
it('should merge concurrent changes', () => {
  const base = createTestDoc().handle.docSync();

  // Fork
  const doc1 = Automerge.change(base, d => { /* change 1 */ });
  const doc2 = Automerge.change(base, d => { /* change 2 */ });

  // Merge
  const merged = Automerge.merge(doc1, doc2);

  // Assert
  expect(merged).toSatisfyMergeInvariant();
});
```

**Pattern 3: Sync Testing**

```typescript
it('should sync between repos', async () => {
  const { repo1, repo2 } = createConnectedRepos();
  const handle1 = repo1.create<OpinionGraphDoc>();

  // Change in repo1
  handle1.change(d => { /* mutation */ });

  // Wait for sync
  const handle2 = repo2.find(handle1.url);
  await waitForSync(handle1, handle2);

  // Assert equality
  expect(handle1.docSync()).toEqual(handle2.docSync());
});
```

---

## Metriken & Ziele

### Coverage-Ziele

| Komponente | Lines | Functions | Branches | Priorität |
|------------|-------|-----------|----------|-----------|
| `lib/src/schema/` | **95%+** | **95%+** | **90%+** | 🔴 KRITISCH |
| `lib/src/hooks/` | **90%+** | **90%+** | **85%+** | 🔴 KRITISCH |
| `lib/src/utils/` | **85%+** | **85%+** | **80%+** | 🟡 HOCH |
| `app/src/components/` | **75%+** | **75%+** | **70%+** | 🟢 MITTEL |
| `app/src/` (gesamt) | **70%+** | **70%+** | **65%+** | 🟢 MITTEL |

### Test-Metriken

**Tracking**:
- Anzahl Tests pro Komponente
- Durchschnittliche Test-Laufzeit
- Flaky Test Rate (< 1%)
- Coverage Trend über Zeit

**Tools**:
- Vitest Coverage Reporter
- Codecov für Trend-Analyse
- GitHub Actions für CI-Metriken

### Definition of Done (Tests)

Ein Feature gilt als **getestet**, wenn:

1. ✅ Unit Tests für alle neuen Funktionen existieren
2. ✅ Integration Tests für CRDT-relevante Änderungen vorhanden
3. ✅ Component Tests für neue UI-Elemente geschrieben
4. ✅ Coverage-Ziele erreicht (siehe Tabelle oben)
5. ✅ Alle Tests in CI grün
6. ✅ Keine Flaky Tests eingeführt
7. ✅ Edge Cases dokumentiert & getestet

---

## Anhang

### A. Nützliche Ressourcen

**Automerge Testing**:
- [Automerge Test Utilities](https://github.com/automerge/automerge-repo/tree/main/tests)
- [CRDT Testing Best Practices](https://crdt.tech/testing)

**React Testing**:
- [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest UI Component Testing](https://vitest.dev/guide/ui.html)

**Playwright**:
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

### B. Glossar

- **CRDT**: Conflict-free Replicated Data Type
- **Automerge**: CRDT-Library für JSON-Dokumente
- **DocHandle**: Automerge-Repo Zugriffspunkt für Dokumente
- **Concurrent Edit**: Gleichzeitige Änderungen von verschiedenen Peers
- **Merge**: Zusammenführen von divergierenden CRDT-Zuständen
- **Last-Write-Wins (LWW)**: Konfliktauflösungs-Strategie (neuester Timestamp gewinnt)

### C. FAQ

**Q: Warum so viele Unit Tests?**
A: CRDTs erfordern penible Datenintegrität. Jede fehlerhafte Mutation kann zu irreparablen Merge-Konflikten führen.

**Q: Brauchen wir wirklich E2E-Tests?**
A: Bei local-first Apps weniger kritisch als bei Server-basierten Apps. Unit + Integration decken die meisten Szenarien ab.

**Q: Wie teste ich Offline-Szenarien?**
A: Integration Tests mit disconnected Repos simulieren Offline. E2E-Tests können Browser-Offline-Modus nutzen.

**Q: Was ist mit Performance-Tests?**
A: Erst ab Phase 4. Fokus liegt auf Korrektheit, dann Performanz.

---

**Letzte Aktualisierung**: 2025-12-02
**Version**: 1.0
**Maintainer**: Claude Code
