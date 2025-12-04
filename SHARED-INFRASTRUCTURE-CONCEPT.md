# Shared Infrastructure Concept

**Status**: Design Phase
**Date**: 2025-12-04
**Related**: [IDENTITY-CONCEPT.md](./IDENTITY-CONCEPT.md), [WEB-OF-TRUST-CONCEPT.md](./WEB-OF-TRUST-CONCEPT.md)

---

## Ziel

Extraktion der gemeinsamen Infrastruktur aus der Narrative App in eine wiederverwendbare Library, um:

1. **Multiple Apps** auf der gleichen Basis zu ermöglichen (Assumptions-App, Map-App, weitere)
2. **Gemeinsame Identität** über alle Apps hinweg zu teilen (DID-basiert)
3. **Web of Trust** app-übergreifend zu nutzen
4. **Code-Duplikation** zu vermeiden

---

## Teil 1: Aktuelle Struktur (Status Quo)

### Was ist aktuell in `app/`?

**App-spezifisch** (Assumptions):
- [MainView.tsx](app/src/components/MainView.tsx) - Assumptions List UI
- [AssumptionCard.tsx](app/src/components/AssumptionCard.tsx) - Domain-spezifisch
- [VoteBar.tsx](app/src/components/VoteBar.tsx) - Domain-spezifisch
- [CreateAssumptionModal.tsx](app/src/components/CreateAssumptionModal.tsx) - Domain-spezifisch

**Infrastruktur** (wiederverwendbar):
- [App.tsx](app/src/App.tsx) - Automerge Repo Setup
- [NarrativeApp.tsx](app/src/NarrativeApp.tsx) - Document & Identity Management
- [ProfileModal.tsx](app/src/components/ProfileModal.tsx) - Identity UI
- [CollaboratorsModal.tsx](app/src/components/CollaboratorsModal.tsx) - User List UI
- [LoadingScreen.tsx](app/src/components/LoadingScreen.tsx) - Generic Loading
- [UserAvatar.tsx](app/src/components/UserAvatar.tsx) - Generic User Display

### Was ist aktuell in `lib/`?

- [schema/index.ts](lib/src/schema/index.ts) - **OpinionGraphDoc** (domain-spezifisch!)
- [hooks/useOpinionGraph.ts](lib/src/hooks/useOpinionGraph.ts) - Domain-spezifisch
- [utils/did.ts](lib/src/utils/did.ts) - Generic DID Utils ✅
- [utils/signature.ts](lib/src/utils/signature.ts) - Generic Signature Utils ✅

---

## Teil 2: Ziel-Architektur

### Neue Monorepo-Struktur

```
narrative/
├── lib/                          # Shared library (narrative-ui)
│   ├── schema/
│   │   ├── identity.ts           # ✨ NEW: UserIdentity, IdentityProfile, TrustAttestation
│   │   ├── document.ts           # ✨ NEW: BaseDocument<T> - Generic document wrapper
│   │   └── opinion-graph.ts      # ✨ MOVED: OpinionGraphDoc (domain-specific)
│   ├── hooks/
│   │   ├── useDocument.ts        # ✨ NEW: Generic document hook
│   │   ├── useIdentity.ts        # ✨ NEW: Identity management hook
│   │   ├── useRepository.ts      # ✨ NEW: Repo initialization hook
│   │   └── useOpinionGraph.ts    # ✨ KEEP: Domain-specific hook
│   ├── components/               # ✨ NEW: Shared React components
│   │   ├── AppShell.tsx          # Document & identity initialization
│   │   ├── ProfileModal.tsx      # Identity editor
│   │   ├── CollaboratorsModal.tsx# User list viewer
│   │   ├── LoadingScreen.tsx     # Generic loading
│   │   ├── UserAvatar.tsx        # User display
│   │   └── TrustIndicator.tsx    # ✨ NEW: Trust level badge (WoT)
│   ├── utils/
│   │   ├── did.ts                # DID generation & parsing
│   │   ├── signature.ts          # JWS signing & verification
│   │   ├── trust.ts              # ✨ NEW: Web of Trust calculations
│   │   └── storage.ts            # ✨ NEW: localStorage abstraction
│   └── index.ts
│
├── app/                          # Narrative Assumptions App
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx               # ✨ SIMPLIFIED: Use AppShell from lib
│   │   └── components/
│   │       ├── MainView.tsx      # Domain-specific: Assumptions UI
│   │       ├── AssumptionCard.tsx
│   │       ├── VoteBar.tsx
│   │       └── CreateAssumptionModal.tsx
│   └── package.json
│
├── map-app/                      # ✨ NEW: Leaflet Map App
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx               # Use AppShell from lib
│   │   ├── schema/
│   │   │   └── map-doc.ts        # MapDocument schema
│   │   ├── hooks/
│   │   │   └── useMapDocument.ts # Map-specific hook
│   │   └── components/
│   │       ├── MapView.tsx       # Leaflet map
│   │       ├── ProfileMarker.tsx # User profile on map
│   │       └── CreateProfileModal.tsx
│   └── package.json
│
└── package.json                  # Root workspace
```

---

## Teil 3: Kern-Abstraktionen

### 3.1 Generic Document Schema

**Problem**: `OpinionGraphDoc` ist domain-spezifisch, aber alle Apps brauchen Identity & Trust.

**Lösung**: Generic `BaseDocument<T>` Wrapper

```typescript
// lib/src/schema/document.ts

/**
 * Base document structure shared by all Narrative apps
 * Wraps app-specific data with shared identity & trust infrastructure
 */
export interface BaseDocument<TData = unknown> {
  // Metadata
  version: string;
  lastModified: number;

  // Identity (shared across all apps)
  identities: Record<string, IdentityProfile>;  // DID → profile

  // Web of Trust (shared across all apps)
  trustAttestations: Record<string, TrustAttestation>;

  // App-specific data
  data: TData;
}

/**
 * Create empty base document
 */
export function createBaseDocument<TData>(
  initialData: TData,
  creatorIdentity: UserIdentity
): BaseDocument<TData> {
  return {
    version: '1.0.0',
    lastModified: Date.now(),
    identities: {
      [creatorIdentity.did]: {
        displayName: creatorIdentity.displayName,
        avatarUrl: creatorIdentity.avatarUrl,
        publicKey: creatorIdentity.publicKey,
      },
    },
    trustAttestations: {},
    data: initialData,
  };
}
```

**Verwendung in Assumptions App:**

```typescript
// lib/src/schema/opinion-graph.ts

import { BaseDocument } from './document';

/**
 * Opinion Graph specific data
 */
export interface OpinionGraphData {
  assumptions: Record<string, Assumption>;
  votes: Record<string, Vote>;
  tags: Record<string, Tag>;
  edits: Record<string, EditEntry>;
}

/**
 * Full Opinion Graph Document
 */
export type OpinionGraphDoc = BaseDocument<OpinionGraphData>;

/**
 * Create empty opinion graph document
 */
export function createEmptyOpinionGraphDoc(
  creatorIdentity: UserIdentity
): OpinionGraphDoc {
  return createBaseDocument<OpinionGraphData>(
    {
      assumptions: {},
      votes: {},
      tags: {},
      edits: {},
    },
    creatorIdentity
  );
}
```

**Verwendung in Map App:**

```typescript
// map-app/src/schema/map-doc.ts

import { BaseDocument } from 'narrative-ui';

/**
 * Map specific data
 */
export interface MapData {
  profiles: Record<string, ProfileMarker>;  // DID → profile with location
}

export interface ProfileMarker {
  did: string;
  latitude: number;
  longitude: number;
  bio?: string;
  interests?: string[];
  updatedAt: number;
}

/**
 * Full Map Document
 */
export type MapDoc = BaseDocument<MapData>;

/**
 * Create empty map document
 */
export function createEmptyMapDoc(
  creatorIdentity: UserIdentity
): MapDoc {
  return createBaseDocument<MapData>(
    {
      profiles: {},
    },
    creatorIdentity
  );
}
```

### 3.2 AppShell Component

**Problem**: Jede App muss Repo, Document, Identity initialisieren → Code-Duplikation

**Lösung**: Generic `AppShell` Component

```typescript
// lib/src/components/AppShell.tsx

import { ReactNode } from 'react';
import { Repo } from '@automerge/automerge-repo';
import { RepoContext } from '@automerge/automerge-repo-react-hooks';
import { DocumentId } from '@automerge/automerge-repo';

export interface AppShellProps<TDoc> {
  /**
   * Automerge repo instance
   * (can be created by useRepository hook or passed directly)
   */
  repo: Repo;

  /**
   * Factory function to create empty document with user identity
   */
  createEmptyDocument: (identity: UserIdentity) => TDoc;

  /**
   * localStorage key prefix for this app (e.g., 'narrative', 'mapapp')
   */
  storagePrefix: string;

  /**
   * Render function that receives initialized document and identity
   */
  children: (props: {
    documentId: DocumentId;
    currentUserDid: string;
    privateKey?: string;
    publicKey?: string;
    displayName?: string;
    onResetIdentity: () => void;
    onNewDocument: () => void;
  }) => ReactNode;
}

/**
 * Generic app shell that handles:
 * - Automerge repo initialization
 * - Document creation/loading (URL hash + localStorage)
 * - Identity management (DID generation + localStorage)
 * - Fake DID migration
 */
export function AppShell<TDoc>({
  repo,
  createEmptyDocument,
  storagePrefix,
  children,
}: AppShellProps<TDoc>) {
  // ... (implementation similar to current NarrativeApp.tsx)
  // Uses storagePrefix for localStorage keys:
  // - `${storagePrefix}Identity`
  // - `${storagePrefix}DocId`

  return (
    <RepoContext.Provider value={repo}>
      {/* Loading screen or children with initialized props */}
    </RepoContext.Provider>
  );
}
```

**Verwendung in Assumptions App:**

```typescript
// app/src/App.tsx

import { AppShell, createEmptyOpinionGraphDoc, useRepository } from 'narrative-ui';
import { MainView } from './components/MainView';

function App() {
  const repo = useRepository({
    syncServer: 'wss://sync.automerge.org',
  });

  return (
    <AppShell
      repo={repo}
      createEmptyDocument={createEmptyOpinionGraphDoc}
      storagePrefix="narrative"
    >
      {(props) => <MainView {...props} />}
    </AppShell>
  );
}

export default App;
```

**Verwendung in Map App:**

```typescript
// map-app/src/App.tsx

import { AppShell, useRepository } from 'narrative-ui';
import { createEmptyMapDoc } from './schema/map-doc';
import { MapView } from './components/MapView';

function App() {
  const repo = useRepository({
    syncServer: 'wss://sync.automerge.org',
  });

  return (
    <AppShell
      repo={repo}
      createEmptyDocument={createEmptyMapDoc}
      storagePrefix="mapapp"
    >
      {(props) => <MapView {...props} />}
    </AppShell>
  );
}

export default App;
```

### 3.3 Identity Hook

```typescript
// lib/src/hooks/useIdentity.ts

/**
 * Hook for managing user identity across apps
 * Handles DID generation, localStorage, and identity updates
 */
export function useIdentity(storagePrefix: string) {
  const [identity, setIdentity] = useState<UserIdentity | null>(null);

  // Load or generate identity
  useEffect(() => {
    loadOrGenerateIdentity();
  }, []);

  const loadOrGenerateIdentity = async () => {
    // ... (implementation from NarrativeApp.tsx)
  };

  const updateDisplayName = (newName: string) => {
    // ... update localStorage and state
  };

  const resetIdentity = () => {
    // ... clear localStorage and reload
  };

  return {
    identity,
    updateDisplayName,
    resetIdentity,
  };
}
```

### 3.4 Repository Hook

```typescript
// lib/src/hooks/useRepository.ts

/**
 * Hook for creating and configuring Automerge Repo
 */
export function useRepository(options: {
  syncServer?: string;
  enableBroadcastChannel?: boolean;
}) {
  const repo = useMemo(() => {
    const adapters: NetworkAdapter[] = [];

    if (options.syncServer) {
      adapters.push(new BrowserWebSocketClientAdapter(options.syncServer));
    }

    if (options.enableBroadcastChannel) {
      adapters.push(new BroadcastChannelNetworkAdapter());
    }

    return new Repo({
      storage: new IndexedDBStorageAdapter(),
      network: adapters,
    });
  }, [options.syncServer, options.enableBroadcastChannel]);

  return repo;
}
```

---

## Teil 4: Gemeinsame Identität über Apps hinweg

### Problem

Zwei Apps auf verschiedenen Subdomains/Pfaden haben unterschiedliche localStorage → unterschiedliche Identitäten.

**Beispiel:**
- `narrative.app/assumptions` → `narrativeIdentity` in localStorage
- `narrative.app/map` → `mapappIdentity` in localStorage
- **Problem**: Gleicher Nutzer hat 2 DIDs!

### Lösungsoptionen

#### Option 1: Shared localStorage Key ✅ **EMPFOHLEN**

**Beschreibung**: Beide Apps nutzen den gleichen localStorage Key für Identität

```typescript
// Beide Apps nutzen:
const identity = localStorage.getItem('narrative_shared_identity');
```

**Vorteile:**
- ✅ Einfach zu implementieren
- ✅ Funktioniert auf gleicher Domain
- ✅ Keine zusätzliche Infrastruktur

**Nachteile:**
- ❌ Funktioniert nur auf gleicher Domain (nicht cross-origin)
- ❌ Keine Synchronisation zwischen Tabs (außer Storage Events)

**Implementierung:**

```typescript
// lib/src/utils/storage.ts

const SHARED_IDENTITY_KEY = 'narrative_shared_identity';

export function loadSharedIdentity(): UserIdentity | null {
  const json = localStorage.getItem(SHARED_IDENTITY_KEY);
  return json ? JSON.parse(json) : null;
}

export function saveSharedIdentity(identity: UserIdentity & { privateKey?: string }) {
  localStorage.setItem(SHARED_IDENTITY_KEY, JSON.stringify(identity));
}
```

**Nutzung in beiden Apps:**

```typescript
// In AppShell
const identity = loadSharedIdentity() || await generateDidIdentity();
saveSharedIdentity(identity);
```

#### Option 2: Identity Document (Automerge-basiert)

**Beschreibung**: Identität wird selbst als Automerge-Dokument gespeichert

```typescript
// Special document type: IdentityDoc
interface IdentityDoc {
  did: string;
  displayName?: string;
  publicKey?: string;
  // privateKey stored separately in localStorage (never synced)
}

// User's identity doc ID stored in localStorage
const identityDocId = localStorage.getItem('narrative_identity_doc_id');
const identityDoc = repo.find<IdentityDoc>(identityDocId);
```

**Vorteile:**
- ✅ Identität synchronisiert über Geräte
- ✅ Versionierung (Automerge history)
- ✅ Funktioniert cross-origin (wenn beide Apps gleichen Sync-Server nutzen)

**Nachteile:**
- ❌ Komplexer
- ❌ Private Key muss trotzdem lokal gespeichert werden
- ❌ Zusätzliches Dokument pro User

#### Option 3: Subdomain Cookie/Storage

**Beschreibung**: Cookie auf `*.narrative.app` setzt shared identity

**Vorteile:**
- ✅ Funktioniert über Subdomains

**Nachteile:**
- ❌ Nicht für `localhost` Testing geeignet
- ❌ Komplexere Cookie-Verwaltung
- ❌ Privacy-Bedenken

### Empfehlung: **Option 1 (Shared localStorage Key)**

**Warum:**
- MVP-freundlich
- Funktioniert für gleiche Domain (assumptions.narrative.app + map.narrative.app = gleiche Subdomain)
- Einfach zu testen (localhost)
- Kann später zu Option 2 migriert werden

**Migration Path:**
1. **Phase 1**: Shared localStorage Key (beide Apps auf gleicher Domain)
2. **Phase 2** (optional): Identity Doc (wenn cross-device sync gewünscht)

---

## Teil 5: Map App Spezifikation

### Ziel

Eine geografische Karten-App, auf der Nutzer ihre Profile mit Location teilen können.

### Features

1. **Karte** (Leaflet.js)
   - Zeigt alle Profile als Marker
   - Click auf Marker → Profil-Details

2. **Eigenes Profil setzen**
   - Drag-and-drop Marker auf Karte
   - Bio-Text, Interessen hinzufügen

3. **Trust Integration**
   - Marker-Farbe basierend auf Trust Level:
     - Grün = Verified
     - Blau = Trusted
     - Grau = Unknown
     - Rot = Blocked
   - Filter: "Nur vertrauenswürdige Profile anzeigen"

4. **Sync**
   - Gleiche Automerge-Infrastruktur wie Assumptions App
   - Real-time Marker-Updates

### Schema

```typescript
// map-app/src/schema/map-doc.ts

export interface ProfileMarker {
  did: string;
  latitude: number;
  longitude: number;
  bio?: string;
  interests?: string[];
  updatedAt: number;

  // Phase 2: Signature
  signature?: string;
}

export interface MapData {
  profiles: Record<string, ProfileMarker>;  // DID → profile
}

export type MapDoc = BaseDocument<MapData>;
```

### Hook

```typescript
// map-app/src/hooks/useMapDocument.ts

export function useMapDocument(documentId: DocumentId, currentUserDid: string) {
  const docHandle = useHandle<MapDoc>(documentId);
  const [doc] = useDocument<MapDoc>(documentId);

  const updateMyProfile = (profile: Partial<ProfileMarker>) => {
    docHandle.change((d) => {
      if (!d.data.profiles[currentUserDid]) {
        d.data.profiles[currentUserDid] = {
          did: currentUserDid,
          latitude: 0,
          longitude: 0,
          updatedAt: Date.now(),
        };
      }
      Object.assign(d.data.profiles[currentUserDid], profile);
      d.data.profiles[currentUserDid].updatedAt = Date.now();
      d.lastModified = Date.now();
    });
  };

  const getAllProfiles = () => {
    return Object.values(doc?.data.profiles ?? {});
  };

  return {
    doc,
    updateMyProfile,
    getAllProfiles,
  };
}
```

### UI Komponenten

**MapView.tsx:**
```tsx
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

export function MapView({ documentId, currentUserDid, ... }: Props) {
  const { doc, updateMyProfile, getAllProfiles } = useMapDocument(documentId, currentUserDid);
  const profiles = getAllProfiles();

  return (
    <div className="h-screen flex flex-col">
      {/* Header with AppBar (from lib) */}
      <AppBar onNewDocument={onNewDocument} onResetIdentity={onResetIdentity} />

      {/* Map */}
      <MapContainer center={[51.505, -0.09]} zoom={13} className="flex-1">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {profiles.map((profile) => (
          <ProfileMarker
            key={profile.did}
            profile={profile}
            currentUserDid={currentUserDid}
            doc={doc}
          />
        ))}
      </MapContainer>
    </div>
  );
}
```

**ProfileMarker.tsx:**
```tsx
import { Marker, Popup } from 'react-leaflet';
import { TrustIndicator } from 'narrative-ui';

export function ProfileMarker({ profile, currentUserDid, doc }: Props) {
  const trustLevel = calculateTrustLevel(profile.did, currentUserDid, doc);
  const markerColor = getTrustColor(trustLevel);

  return (
    <Marker position={[profile.latitude, profile.longitude]} icon={createColorIcon(markerColor)}>
      <Popup>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UserAvatar did={profile.did} doc={doc} />
            <TrustIndicator did={profile.did} currentUserDid={currentUserDid} doc={doc} />
          </div>
          <p className="text-sm">{profile.bio}</p>
          <div className="flex gap-1 flex-wrap">
            {profile.interests?.map((interest) => (
              <span key={interest} className="badge badge-sm">{interest}</span>
            ))}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
```

---

## Teil 6: Migration Plan

### Phase 1: Lib-Abstraktion (4-6h)

**Ziel**: Gemeinsame Infrastruktur in `lib/` extrahieren

1. **Schema-Refactoring** (1h)
   - `BaseDocument<T>` erstellen
   - `OpinionGraphDoc` anpassen zu `BaseDocument<OpinionGraphData>`
   - Identity & Trust schemas in eigene Dateien

2. **Hooks extrahieren** (1h)
   - `useRepository()` erstellen
   - `useIdentity()` erstellen
   - `useDocument()` generic wrapper

3. **Komponenten in lib/ verschieben** (2h)
   - `AppShell` komponente erstellen (basierend auf NarrativeApp.tsx)
   - `ProfileModal`, `CollaboratorsModal`, `LoadingScreen`, `UserAvatar` verschieben
   - Exports in `lib/src/index.ts` hinzufügen

4. **Shared Storage** (30min)
   - `storage.ts` utility mit `loadSharedIdentity()`, `saveSharedIdentity()`

5. **App refactoren** (1h)
   - `app/src/App.tsx` vereinfachen (nutze AppShell)
   - Tests anpassen

6. **Build & Test** (30min)
   - `npm run build`
   - Manuelle Tests (2-browser sync)

### Phase 2: Map App erstellen (4-6h)

**Ziel**: Neue Map-App mit Leaflet

1. **Workspace Setup** (30min)
   ```bash
   mkdir map-app
   cd map-app
   npm init -y
   npm install react react-dom leaflet react-leaflet
   npm install --save-dev vite @vitejs/plugin-react
   npm install narrative-ui
   ```

2. **Schema** (30min)
   - `map-app/src/schema/map-doc.ts` erstellen

3. **Hook** (1h)
   - `map-app/src/hooks/useMapDocument.ts` erstellen
   - CRUD für ProfileMarker

4. **UI** (2-3h)
   - `MapView.tsx` mit Leaflet
   - `ProfileMarker.tsx` mit Trust-Integration
   - `CreateProfileModal.tsx`

5. **Build & Test** (1h)
   - Beide Apps parallel testen
   - Shared Identity verifizieren

### Phase 3: Web of Trust Integration (8-12h)

**Ziel**: Trust-System in beide Apps integrieren

1. **Trust Schema** (1h)
   - `TrustAttestation` entity hinzufügen

2. **Trust Calculation** (2h)
   - `calculateTrustLevel()` funktion
   - BFS für transitive trust

3. **Trust UI** (3h)
   - `TrustIndicator` component
   - `TrustManager` modal
   - Integration in beide Apps

4. **Voting Filter** (2h)
   - Filter votes by trust in Assumptions App
   - Filter profiles by trust in Map App

5. **Tests** (2h)
   - Unit tests für trust calculation
   - Integration tests

---

## Teil 7: Offene Fragen & Entscheidungen

### Frage 1: BaseDocument vs. Mixins?

**Option A: BaseDocument Wrapper** (vorgeschlagen)
```typescript
interface BaseDocument<TData> {
  identities: Record<string, IdentityProfile>;
  trustAttestations: Record<string, TrustAttestation>;
  data: TData;
}
```

**Option B: Mixins/Composition**
```typescript
interface OpinionGraphDoc extends IdentityMixin, TrustMixin {
  assumptions: Record<string, Assumption>;
  votes: Record<string, Vote>;
}
```

**Welche bevorzugst du?**

### Frage 2: Komponenten in lib/ - TypeScript oder TSX?

**Problem**: React Komponenten in `lib/` → benötigen TSX, aber lib nutzt aktuell nur TS

**Optionen:**
- A: `lib/` zu TSX + Vite Build (wie app) migrieren
- B: Komponenten in separates Package (`@narrative/components`)
- C: Komponenten in beiden Apps duplizieren (kein Sharing)

**Welche bevorzugst du?**

### Frage 3: Storage Prefix - Strategie?

**Varianten:**
- A: Shared Key `narrative_shared_identity` (app-übergreifend)
- B: Per-App Keys `narrative_identity`, `mapapp_identity` (separiert)
- C: Hybrid: Identity shared, DocId per-app

**Welche bevorzugst du?**

### Frage 4: Map App - Separate Repo oder Monorepo?

**Option A: Monorepo** (vorgeschlagen)
```
narrative/
├── lib/
├── app/
└── map-app/
```

**Option B: Separate Repos**
```
narrative/        (lib + assumptions app)
narrative-map/    (map app, depends on narrative-ui via npm)
```

**Welche bevorzugst du?**

### Frage 5: Leaflet - Tile Server?

**Optionen:**
- OpenStreetMap (kostenlos, Rate-Limited)
- Mapbox (schöner, benötigt API Key)
- Self-hosted Tiles (komplex)

**Welche bevorzugst du?**

---

## Teil 8: Nächste Schritte

1. **Diskussion** dieser Fragen
2. **Finalisierung** der Architektur-Entscheidungen
3. **Implementierung** starten (Phase 1)

---

## Zusammenfassung

**Was wird erreicht:**
- ✅ Wiederverwendbare Infrastruktur in `lib/`
- ✅ Zwei Apps (Assumptions, Map) auf gleicher Basis
- ✅ Gemeinsame Identität (DID-basiert)
- ✅ Vorbereitung für Web of Trust
- ✅ Code-Reduktion durch Sharing

**Aufwand:**
- Phase 1 (Refactoring): 4-6h
- Phase 2 (Map App): 4-6h
- Phase 3 (Web of Trust): 8-12h
- **Total: 16-24h**

---

Lass uns die offenen Fragen diskutieren! 🚀
