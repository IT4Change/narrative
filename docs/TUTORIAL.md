# Tutorial: Deine erste Narrative App

Dieses Tutorial führt dich Schritt für Schritt durch die Erstellung einer eigenen App für das Narrative Web of Trust Ökosystem.

## Was du bauen wirst

Eine einfache **Notizen-App** mit:
- Geteilte Notizen im Workspace
- Trust-Integration (nur vertrauenswürdige Notizen anzeigen)
- Offline-First mit Echtzeit-Sync

## Voraussetzungen

- Node.js 18+
- Grundkenntnisse in React & TypeScript
- Git

## Schritt 1: Repository klonen & Setup

```bash
# Repository klonen
git clone https://github.com/it4change/narrative.git
cd narrative

# Dependencies installieren
npm install

# Library bauen (erforderlich!)
npm run build:lib
```

## Schritt 2: App scaffolden

```bash
npm run create-app notes-app --port 3010 --title "Notizen"
npm install
```

Das erstellt:
```
notes-app/
├── src/
│   ├── schema/index.ts      # Dein Datenmodell
│   ├── components/MainView.tsx
│   ├── App.tsx
│   └── debug.ts
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

## Schritt 3: Datenmodell definieren

Öffne `notes-app/src/schema/index.ts` und definiere deine Datenstruktur:

```typescript
import type { BaseDocument, UserIdentity } from 'narrative-ui';
import { createBaseDocument, generateId } from 'narrative-ui';

/**
 * Eine Notiz
 */
export interface Note {
  id: string;
  content: string;
  authorDid: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * App-spezifische Daten
 */
export interface NotesData {
  notes: Record<string, Note>;
}

/**
 * Vollständiges Notizen-Dokument
 */
export type NotesDoc = BaseDocument<NotesData>;

/**
 * Leeres Dokument erstellen
 */
export function createEmptyNotesDoc(creatorIdentity: UserIdentity): NotesDoc {
  return createBaseDocument<NotesData>(
    { notes: {} },
    creatorIdentity
  );
}

/**
 * Neue Notiz erstellen
 */
export function createNote(authorDid: string, content: string): Note {
  const now = Date.now();
  return {
    id: generateId(),
    content,
    authorDid,
    createdAt: now,
    updatedAt: now,
  };
}
```

## Schritt 4: UI bauen

Öffne `notes-app/src/components/MainView.tsx` und ersetze den Inhalt:

```typescript
import { useState } from 'react';
import type { DocHandle, AutomergeUrl, DocumentId } from '@automerge/automerge-repo';
import { useDocHandle, useDocument } from '@automerge/automerge-repo-react-hooks';
import {
  AppLayout,
  type AppContextValue,
  type UserDocument,
  ClickableUserName,
} from 'narrative-ui';
import type { NotesDoc } from '../schema';
import { createNote } from '../schema';

interface MainViewProps {
  documentId: DocumentId;
  currentUserDid: string;
  privateKey?: string;
  onResetIdentity: () => void;
  onNewDocument: (name?: string) => void;
  userDocId?: string;
  userDocHandle?: DocHandle<UserDocument>;
}

export function MainView({
  documentId,
  currentUserDid,
  onResetIdentity,
  onNewDocument,
  userDocId,
  userDocHandle,
}: MainViewProps) {
  const [newNoteContent, setNewNoteContent] = useState('');

  const docHandle = useDocHandle<NotesDoc>(documentId);
  const [doc] = useDocument<NotesDoc>(documentId);
  const [userDoc] = useDocument<UserDocument>(userDocId as AutomergeUrl | undefined);

  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;

  // Notiz hinzufügen
  const handleAddNote = () => {
    if (!docHandle || !newNoteContent.trim()) return;

    docHandle.change((d) => {
      const note = createNote(currentUserDid, newNoteContent.trim());
      d.data.notes[note.id] = note;
      d.lastModified = Date.now();
    });

    setNewNoteContent('');
  };

  // Notiz löschen
  const handleDeleteNote = (noteId: string) => {
    if (!docHandle) return;

    docHandle.change((d) => {
      delete d.data.notes[noteId];
      d.lastModified = Date.now();
    });
  };

  // Identity im Doc updaten
  const updateIdentity = (did: string, updates: { displayName?: string; avatarUrl?: string }) => {
    if (!docHandle) return;
    docHandle.change((d) => {
      if (!d.identities[did]) d.identities[did] = {};
      if (updates.displayName !== undefined) d.identities[did].displayName = updates.displayName;
      if (updates.avatarUrl !== undefined) d.identities[did].avatarUrl = updates.avatarUrl;
      d.lastModified = Date.now();
    });
  };

  if (!doc) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // Notizen sortiert nach Erstellungsdatum
  const notes = Object.values(doc.data.notes).sort(
    (a, b) => b.createdAt - a.createdAt
  );

  return (
    <AppLayout
      doc={doc}
      docHandle={docHandle}
      documentId={documentId.toString()}
      currentUserDid={currentUserDid}
      appTitle="Notizen"
      workspaceName="Notizen"
      logoUrl={logoUrl}
      onResetIdentity={onResetIdentity}
      onCreateWorkspace={onNewDocument}
      onUpdateIdentityInDoc={(updates) => updateIdentity(currentUserDid, updates)}
      userDocHandle={userDocHandle}
      userDoc={userDoc}
      userDocUrl={userDocHandle?.url}
    >
      {(ctx: AppContextValue) => (
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 max-w-2xl">

            {/* Neue Notiz */}
            <div className="card bg-base-100 shadow-xl mb-6">
              <div className="card-body">
                <textarea
                  className="textarea textarea-bordered w-full"
                  placeholder="Neue Notiz schreiben..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  rows={3}
                />
                <div className="card-actions justify-end mt-2">
                  <button
                    className="btn btn-primary"
                    onClick={handleAddNote}
                    disabled={!newNoteContent.trim()}
                  >
                    Notiz hinzufügen
                  </button>
                </div>
              </div>
            </div>

            {/* Notizen-Liste */}
            <div className="space-y-4">
              {notes.map((note) => {
                const isOwn = note.authorDid === currentUserDid;
                const isTrusted = !!userDoc?.trustGiven?.[note.authorDid];

                return (
                  <div
                    key={note.id}
                    className={`card bg-base-100 shadow ${
                      !isOwn && !isTrusted ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="card-body">
                      <p className="whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center justify-between mt-2 text-sm text-base-content/60">
                        <div className="flex items-center gap-2">
                          <ClickableUserName
                            did={note.authorDid}
                            displayName={doc.identities[note.authorDid]?.displayName}
                            avatarUrl={doc.identities[note.authorDid]?.avatarUrl}
                            onUserClick={ctx.openProfile}
                            showAvatar
                            currentUserDid={currentUserDid}
                          />
                          {isTrusted && (
                            <span className="badge badge-success badge-xs">Vertraut</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>
                            {new Date(note.createdAt).toLocaleString('de-DE')}
                          </span>
                          {isOwn && (
                            <button
                              className="btn btn-ghost btn-xs text-error"
                              onClick={() => handleDeleteNote(note.id)}
                            >
                              Löschen
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {notes.length === 0 && (
              <div className="text-center py-12 text-base-content/60">
                <p className="text-lg">Noch keine Notizen</p>
                <p className="text-sm">Schreibe deine erste Notiz!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
```

## Schritt 5: App starten

```bash
npm run dev:notes
```

Öffne http://localhost:3010 - deine App läuft!

## Schritt 6: Trust-Filter hinzufügen

Erweitere die App um einen Filter, der nur Notizen von vertrauenswürdigen Usern zeigt:

```typescript
// In MainView.tsx - füge State hinzu
const [showOnlyTrusted, setShowOnlyTrusted] = useState(false);

// Filtere Notizen
const filteredNotes = showOnlyTrusted
  ? notes.filter(note =>
      note.authorDid === currentUserDid ||
      !!userDoc?.trustGiven?.[note.authorDid]
    )
  : notes;

// Füge Toggle in JSX hinzu
<label className="label cursor-pointer">
  <span className="label-text">Nur vertrauenswürdige</span>
  <input
    type="checkbox"
    className="toggle toggle-primary"
    checked={showOnlyTrusted}
    onChange={(e) => setShowOnlyTrusted(e.target.checked)}
  />
</label>
```

## Schritt 7: Logo hinzufügen

Erstelle ein Logo als `notes-app/public/logo.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
</svg>
```

## Was du gelernt hast

1. **Schema definieren**: `BaseDocument<T>` für deine Daten
2. **Automerge Mutations**: `docHandle.change()` für CRDT-Updates
3. **Trust-Integration**: `userDoc.trustGiven` für Vertrauensbeziehungen
4. **AppLayout nutzen**: Navbar, Modals, Profile kostenlos

## Nächste Schritte

- **QR-Verifizierung**: User können sich gegenseitig verifizieren
- **Workspace-Switcher**: Zwischen Notiz-Boards wechseln
- **Reactions**: Andere auf Notizen reagieren lassen

## Hilfreiche Ressourcen

- [lib/README.md](../lib/README.md) - Library-Dokumentation
- [lib/src/hooks/README.md](../lib/src/hooks/README.md) - Hooks-Referenz
- [CLAUDE.md](../CLAUDE.md) - AI-Development-Guide
- [WEB-OF-TRUST-CONCEPT.md](./WEB-OF-TRUST-CONCEPT.md) - Trust-Architektur

## Beispiel-Apps

Schau dir die existierenden Apps als Referenz an:

| App | Fokus |
|-----|-------|
| `narrative-app/` | Abstimmungen, Votes |
| `map-app/` | Geo-Daten, Marker |
| `market-app/` | Listings, Reactions |
| `dank-app/` | Voucher, Transfers |
