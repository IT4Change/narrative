# Community Module System - Konzept & Umsetzungsstrategie

> **Vision**: Jeder kann in 5 Minuten ein Modul erstellen, das automatisch CRDT-Sync bekommt und mit der Community geteilt werden kann.

## Inhaltsverzeichnis

1. [Problemstellung](#problemstellung)
2. [Lösungsansatz](#lösungsansatz)
3. [Architektur](#architektur)
4. [Module SDK API](#module-sdk-api)
5. [Beispiele](#beispiele)
6. [Distribution & Marketplace](#distribution--marketplace)
7. [Umsetzungsstrategie](#umsetzungsstrategie)
8. [Sicherheit & Governance](#sicherheit--governance)

---

## Problemstellung

### Aktuelle Komplexität

Ein neues Modul zu erstellen erfordert derzeit:

1. **Automerge-Wissen**: CRDT-Patterns, `.change()` Callbacks, Mutation-Regeln
2. **Wrapper-Boilerplate**: ~150 Zeilen pro Modul für Datenzugriff
3. **Type-Casting**: `as any` Workarounds wegen erweiterter Props
4. **Manuelle Integration**: UnifiedApp.tsx anpassen, Types erweitern

**Resultat**: Nur erfahrene Entwickler können Module erstellen.

### Zielgruppe: Vibe-Coder

- Kennen React/JSX Basics
- Nutzen AI-Tools wie Cursor/Claude zum Coden
- Wollen schnelle Ergebnisse ohne tiefes Framework-Verständnis
- Lernen durch Beispiele, nicht durch Dokumentation

---

## Lösungsansatz

### Kernprinzip: "Schema-First, Zero-Boilerplate"

```
Entwickler definiert:     SDK generiert automatisch:
─────────────────────     ────────────────────────────
Schema (Datenstruktur) → CRUD-Operationen
                       → TypeScript Types
                       → Automerge Mutations
                       → Query Helpers
                       → React Hooks
```

### Die drei Säulen

1. **Deklaratives Schema**: Beschreibe deine Daten, nicht wie sie gespeichert werden
2. **Auto-Generated CRUD**: `create.todo()`, `update.todo()`, `remove.todo()` - fertig
3. **Plug & Play Distribution**: Module als npm-Packages oder GitHub-URLs

---

## Architektur

### Paketstruktur

```
@narrative/
├── module-sdk/           # Core SDK für Modul-Entwicklung
│   ├── defineModule()    # Modul-Definition
│   ├── useModule()       # React Hook
│   └── schema/           # Schema-Parser & Validierung
│
├── module-runtime/       # Runtime für dynamisches Laden
│   ├── ModuleLoader      # Lädt externe Module
│   └── ModuleSandbox     # Isolation & Permissions
│
└── module-cli/           # Developer Tools
    ├── create            # Modul-Generator
    ├── dev               # Dev-Server
    └── publish           # Registry-Upload
```

### Modul-Struktur

```
my-module/
├── module.config.ts      # Schema & Metadaten
├── MyModule.tsx          # React UI Component
├── package.json          # Dependencies
└── README.md             # Dokumentation
```

### Integration in UnifiedApp

```
┌─────────────────────────────────────────────────────────┐
│                     UnifiedApp                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Narrative  │  │     Map     │  │   Market    │     │
│  │  (builtin)  │  │  (builtin)  │  │  (builtin)  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │    Todo     │  │    Polls    │  │   Kanban    │     │
│  │ (community) │  │ (community) │  │ (community) │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │              Module Runtime                        │ │
│  │  - Schema Validation                              │ │
│  │  - CRUD Generation                                │ │
│  │  - Automerge Bridge                               │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Module SDK API

### 1. Modul Definition

```typescript
// module.config.ts
import { defineModule } from '@narrative/module-sdk';

export default defineModule({
  // Metadaten
  id: 'todo',
  name: 'Todo List',
  icon: '✅',
  version: '1.0.0',
  description: 'Simple collaborative todo list',
  author: 'community',

  // Daten-Schema
  schema: {
    todos: {
      type: 'collection',
      fields: {
        text: 'string',
        done: 'boolean',
        priority: 'number?',        // Optional
        tags: 'string[]',           // Array
        createdBy: 'user',          // Auto: currentUserDid
        createdAt: 'timestamp',     // Auto: Date.now()
        updatedAt: 'timestamp',
      }
    }
  },

  // UI Component
  component: './TodoModule.tsx',
});
```

### 2. Schema Types

| Type | Beschreibung | Beispiel |
|------|--------------|----------|
| `string` | Text | `title: 'string'` |
| `text` | Langer Text (Textarea) | `content: 'text'` |
| `number` | Zahl | `count: 'number'` |
| `boolean` | Ja/Nein | `done: 'boolean'` |
| `timestamp` | Unix Timestamp | `createdAt: 'timestamp'` |
| `user` | User DID (auto-filled) | `createdBy: 'user'` |
| `string[]` | String Array | `tags: 'string[]'` |
| `type?` | Optional | `description: 'string?'` |

### 3. Collection Types

```typescript
schema: {
  // Collection: Liste von Items
  posts: {
    type: 'collection',
    fields: { ... }
  },

  // Singleton: Ein Objekt pro Scope
  settings: {
    type: 'singleton',
    scope: 'user',      // 'user' | 'workspace' | 'global'
    fields: { ... }
  },

  // Map: Key-Value Store
  reactions: {
    type: 'map',
    key: '{postId}:{userDid}',   // Composite Key Template
    fields: { ... }
  }
}
```

### 4. useModule Hook

```tsx
import { useModule } from '@narrative/module-sdk';

function MyModule() {
  const {
    // Daten
    data,

    // CRUD Operationen (auto-generiert aus Schema)
    create,    // create.todo({ text: '...' })
    update,    // update.todo(id, { done: true })
    remove,    // remove.todo(id)

    // Query Helpers
    query,     // query.todos.all(), query.todos.where({ done: false })

    // Kontext
    context,   // { currentUserDid, identities, trustAttestations }

    // Utilities
    isLoading,
    error,
  } = useModule('todo');

  // ...
}
```

### 5. Query API

```typescript
// Alle Items
const allTodos = query.todos.all();

// Gefiltert
const myTodos = query.todos.where({ createdBy: context.currentUserDid });
const openTodos = query.todos.where({ done: false });

// Sortiert
const byDate = query.todos.orderBy('createdAt', 'desc');

// Kombiniert
const myOpenTodos = query.todos
  .where({ createdBy: 'me', done: false })
  .orderBy('priority', 'asc');

// Einzelnes Item
const todo = query.todos.get(id);

// Existenz prüfen
const hasVoted = query.votes.exists({ postId, userDid: 'me' });

// Zählen
const voteCount = query.votes.count({ postId });
```

---

## Beispiele

### Beispiel 1: Todo List (Einfach)

```typescript
// todo-module/module.config.ts
import { defineModule } from '@narrative/module-sdk';

export default defineModule({
  id: 'todo',
  name: 'Todo List',
  icon: '✅',
  version: '1.0.0',

  schema: {
    todos: {
      type: 'collection',
      fields: {
        text: 'string',
        done: 'boolean',
        createdBy: 'user',
        createdAt: 'timestamp',
      }
    }
  },

  component: './TodoModule.tsx',
});
```

```tsx
// todo-module/TodoModule.tsx
import { useModule } from '@narrative/module-sdk';
import { useState } from 'react';

export function TodoModule() {
  const { query, create, update, remove, context } = useModule('todo');
  const [newTodo, setNewTodo] = useState('');

  const todos = query.todos.orderBy('createdAt', 'desc');

  const handleAdd = () => {
    if (!newTodo.trim()) return;
    create.todo({ text: newTodo, done: false });
    setNewTodo('');
  };

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="flex gap-2">
        <input
          className="input input-bordered flex-1"
          value={newTodo}
          onChange={e => setNewTodo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Was ist zu tun?"
        />
        <button className="btn btn-primary" onClick={handleAdd}>
          Hinzufügen
        </button>
      </div>

      {/* Todo List */}
      <div className="space-y-2">
        {todos.map(todo => (
          <div key={todo.id} className="flex items-center gap-3 p-3 bg-base-100 rounded-lg">
            <input
              type="checkbox"
              className="checkbox"
              checked={todo.done}
              onChange={() => update.todo(todo.id, { done: !todo.done })}
            />
            <span className={todo.done ? 'line-through opacity-50' : ''}>
              {todo.text}
            </span>
            {todo.createdBy === context.currentUserDid && (
              <button
                className="btn btn-ghost btn-sm ml-auto"
                onClick={() => remove.todo(todo.id)}
              >
                🗑️
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Beispiel 2: Polls (Mittel)

```typescript
// polls-module/module.config.ts
import { defineModule } from '@narrative/module-sdk';

export default defineModule({
  id: 'polls',
  name: 'Polls & Voting',
  icon: '📊',
  version: '1.0.0',

  schema: {
    polls: {
      type: 'collection',
      fields: {
        question: 'string',
        options: 'string[]',
        multiSelect: 'boolean',
        endsAt: 'timestamp?',
        createdBy: 'user',
        createdAt: 'timestamp',
      }
    },
    votes: {
      type: 'map',
      key: '{pollId}:{userDid}',
      fields: {
        selectedOptions: 'number[]',
        votedAt: 'timestamp',
      }
    }
  },

  component: './PollsModule.tsx',
});
```

```tsx
// polls-module/PollsModule.tsx
import { useModule } from '@narrative/module-sdk';
import { useState } from 'react';

export function PollsModule() {
  const { query, create, update, context } = useModule('polls');
  const [showCreate, setShowCreate] = useState(false);

  const polls = query.polls.orderBy('createdAt', 'desc');

  return (
    <div className="space-y-6">
      <button
        className="btn btn-primary"
        onClick={() => setShowCreate(true)}
      >
        Neue Umfrage
      </button>

      {polls.map(poll => (
        <PollCard
          key={poll.id}
          poll={poll}
          votes={query.votes.where({ pollId: poll.id })}
          myVote={query.votes.get(`${poll.id}:${context.currentUserDid}`)}
          onVote={(options) => {
            update.vote(`${poll.id}:${context.currentUserDid}`, {
              selectedOptions: options,
            });
          }}
        />
      ))}

      {showCreate && (
        <CreatePollModal
          onClose={() => setShowCreate(false)}
          onCreate={(data) => {
            create.poll(data);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function PollCard({ poll, votes, myVote, onVote }) {
  const totalVotes = votes.length;
  const voteCounts = poll.options.map((_, i) =>
    votes.filter(v => v.selectedOptions.includes(i)).length
  );

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">{poll.question}</h2>

        <div className="space-y-2">
          {poll.options.map((option, i) => {
            const percent = totalVotes > 0
              ? Math.round((voteCounts[i] / totalVotes) * 100)
              : 0;
            const isSelected = myVote?.selectedOptions.includes(i);

            return (
              <button
                key={i}
                className={`w-full p-3 rounded-lg border-2 transition-all ${
                  isSelected ? 'border-primary bg-primary/10' : 'border-base-300'
                }`}
                onClick={() => {
                  if (poll.multiSelect) {
                    const current = myVote?.selectedOptions || [];
                    const updated = isSelected
                      ? current.filter(x => x !== i)
                      : [...current, i];
                    onVote(updated);
                  } else {
                    onVote([i]);
                  }
                }}
              >
                <div className="flex justify-between">
                  <span>{option}</span>
                  <span className="text-base-content/60">{percent}%</span>
                </div>
                <div className="w-full bg-base-300 rounded-full h-2 mt-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-sm text-base-content/60 mt-2">
          {totalVotes} {totalVotes === 1 ? 'Stimme' : 'Stimmen'}
        </div>
      </div>
    </div>
  );
}
```

### Beispiel 3: Kanban Board (Komplex)

```typescript
// kanban-module/module.config.ts
import { defineModule } from '@narrative/module-sdk';

export default defineModule({
  id: 'kanban',
  name: 'Kanban Board',
  icon: '📋',
  version: '1.0.0',

  schema: {
    columns: {
      type: 'collection',
      fields: {
        title: 'string',
        order: 'number',
        color: 'string?',
        createdBy: 'user',
      }
    },
    cards: {
      type: 'collection',
      fields: {
        title: 'string',
        description: 'text?',
        columnId: 'string',
        order: 'number',
        assignee: 'string?',      // User DID
        labels: 'string[]',
        dueDate: 'timestamp?',
        createdBy: 'user',
        createdAt: 'timestamp',
        updatedAt: 'timestamp',
      }
    },
    comments: {
      type: 'collection',
      fields: {
        cardId: 'string',
        text: 'text',
        createdBy: 'user',
        createdAt: 'timestamp',
      }
    }
  },

  // Default-Daten beim ersten Laden
  initialData: {
    columns: [
      { id: 'todo', title: 'To Do', order: 0 },
      { id: 'doing', title: 'In Progress', order: 1 },
      { id: 'done', title: 'Done', order: 2 },
    ]
  },

  component: './KanbanModule.tsx',
});
```

---

## Distribution & Marketplace

### Option 1: npm Packages

```bash
# Installation
npm install @narrative-modules/todo
npm install @narrative-modules/polls

# In der App
import { todoModule } from '@narrative-modules/todo';
import { pollsModule } from '@narrative-modules/polls';

// Registrieren
registerModules([todoModule, pollsModule]);
```

### Option 2: GitHub URLs (Zero-Install)

```typescript
// In App Settings oder URL Parameter
const communityModules = [
  'github:user/narrative-todo-module',
  'github:org/narrative-polls',
];

// Dynamisches Laden
await loadModulesFromGithub(communityModules);
```

### Option 3: In-App Marketplace

```
┌─────────────────────────────────────────────┐
│  🧩 Module Marketplace                      │
├─────────────────────────────────────────────┤
│                                             │
│  Featured                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ ✅ Todo │ │ 📊 Polls│ │ 📋Kanban│       │
│  │ ⭐ 4.8  │ │ ⭐ 4.6  │ │ ⭐ 4.9  │       │
│  │ 1.2k ↓  │ │ 890 ↓   │ │ 2.1k ↓  │       │
│  └─────────┘ └─────────┘ └─────────┘       │
│                                             │
│  Categories                                 │
│  [Productivity] [Communication] [Fun]       │
│                                             │
│  ─────────────────────────────────────      │
│                                             │
│  📤 Import Custom Module                    │
│  ┌─────────────────────────────────────┐   │
│  │ github:user/my-module               │   │
│  └─────────────────────────────────────┘   │
│  [Import]                                   │
│                                             │
└─────────────────────────────────────────────┘
```

### Module Registry

```json
// https://modules.narrative.community/registry.json
{
  "version": "1.0.0",
  "modules": [
    {
      "id": "todo",
      "name": "Todo List",
      "icon": "✅",
      "description": "Simple collaborative todo list",
      "author": {
        "name": "Narrative Team",
        "github": "narrative-community"
      },
      "repository": "github:narrative-community/module-todo",
      "version": "1.2.0",
      "minSdkVersion": "1.0.0",
      "downloads": 1234,
      "rating": 4.8,
      "verified": true,
      "tags": ["productivity", "lists", "collaboration"]
    }
  ]
}
```

---

## Umsetzungsstrategie

### Phase 1: Foundation (2-3 Wochen)

**Ziel**: Module SDK mit Basic CRUD funktioniert

#### 1.1 Schema Parser
- [ ] Schema-Type-Definitionen
- [ ] Validierung der Schema-Struktur
- [ ] TypeScript Type-Generierung aus Schema

#### 1.2 CRUD Generator
- [ ] `create.{entity}()` - Items erstellen
- [ ] `update.{entity}()` - Items aktualisieren
- [ ] `remove.{entity}()` - Items löschen
- [ ] Automerge-Mutations korrekt generieren

#### 1.3 Query Builder
- [ ] `query.{entity}.all()` - Alle Items
- [ ] `query.{entity}.where()` - Filtern
- [ ] `query.{entity}.get()` - Einzelnes Item
- [ ] `query.{entity}.count()` - Zählen

#### 1.4 useModule Hook
- [ ] Schema laden & parsen
- [ ] CRUD-Funktionen bereitstellen
- [ ] Context (currentUserDid, identities) injizieren
- [ ] Reaktivität mit Automerge

#### Deliverable
```tsx
// Das sollte funktionieren:
const { create, query } = useModule('todo');
create.todo({ text: 'Test', done: false });
const todos = query.todos.all();
```

### Phase 2: Developer Experience (2 Wochen)

**Ziel**: Einfaches Erstellen & Testen von Modulen

#### 2.1 CLI Tool
- [ ] `npx create-narrative-module my-module`
- [ ] Interactive Prompts (Name, Schema-Template)
- [ ] Generierte Dateien mit Beispielcode

#### 2.2 Dev Server
- [ ] Hot Reload für Module
- [ ] Isolated Testing Environment
- [ ] Mock-Daten Generator

#### 2.3 Dokumentation
- [ ] Getting Started Guide
- [ ] Schema Reference
- [ ] API Documentation
- [ ] Video Tutorial (5 Min)

#### 2.4 Example Modules
- [ ] Todo (einfach)
- [ ] Polls (mittel)
- [ ] Notes (mit Text-Editing)

#### Deliverable
```bash
npx create-narrative-module my-polls
cd my-polls
npm run dev
# → Lokaler Dev-Server mit Hot Reload
```

### Phase 3: Integration (2 Wochen)

**Ziel**: Module in UnifiedApp laden

#### 3.1 Module Loader
- [ ] Builtin Module laden (Narrative, Map, Market)
- [ ] Community Module aus npm laden
- [ ] Module aktivieren/deaktivieren per User

#### 3.2 UnifiedApp Anpassungen
- [ ] Dynamische Module-Liste statt hardcoded
- [ ] Module-Settings UI
- [ ] Persistenz der aktivierten Module

#### 3.3 Document Schema Migration
- [ ] `doc.data.{moduleId}` dynamisch
- [ ] Schema-Versioning
- [ ] Migrations-Support

#### Deliverable
```typescript
// In UnifiedApp
const modules = await loadModules([
  builtinModules.narrative,
  builtinModules.map,
  'npm:@narrative-modules/todo',
]);
```

### Phase 4: Distribution (2 Wochen)

**Ziel**: Module teilen & installieren

#### 4.1 Module Registry
- [ ] JSON-Registry auf GitHub
- [ ] Submission-Prozess via PR
- [ ] Automatische Validierung

#### 4.2 In-App Marketplace
- [ ] Browse verfügbare Module
- [ ] One-Click Installation
- [ ] Import via GitHub URL

#### 4.3 Publishing Tools
- [ ] `npx narrative-module publish`
- [ ] Version-Management
- [ ] Changelog-Generierung

#### Deliverable
```
User öffnet Marketplace → Klickt "Install" → Modul ist sofort verfügbar
```

### Phase 5: Advanced Features (Ongoing)

#### 5.1 Permissions System
- [ ] Module-Capabilities deklarieren
- [ ] User-Consent für sensible APIs
- [ ] Sandboxed Execution

#### 5.2 Module Communication
- [ ] Events zwischen Modulen
- [ ] Shared Data Access (opt-in)
- [ ] Cross-Module Queries

#### 5.3 Theming & Customization
- [ ] Module-spezifische Themes
- [ ] Custom CSS Support
- [ ] Component Overrides

---

## Sicherheit & Governance

### Sicherheitsmodell

```
┌─────────────────────────────────────────────┐
│              Trust Levels                   │
├─────────────────────────────────────────────┤
│                                             │
│  🔒 Verified (Narrative Team)               │
│     - Voller Zugriff                        │
│     - Code-Review durch Team                │
│                                             │
│  ✅ Community Verified                       │
│     - Community-Review                      │
│     - Grundlegende Permissions              │
│                                             │
│  ⚠️ Unverified                               │
│     - Nur eigene Daten                      │
│     - Sandbox-Modus                         │
│     - Warning bei Installation              │
│                                             │
└─────────────────────────────────────────────┘
```

### Permissions

```typescript
// module.config.ts
export default defineModule({
  // ...

  permissions: {
    // Welche Daten kann das Modul lesen?
    read: ['own-data'],  // nur eigene | 'workspace-data' | 'all-data'

    // Welche APIs darf es nutzen?
    apis: [
      'storage',        // LocalStorage
      // 'network',     // Externe Requests (nicht by default)
      // 'camera',      // Kamera-Zugriff
    ],
  },
});
```

### Governance

1. **Open Registry**: Jeder kann Module einreichen via GitHub PR
2. **Community Review**: Mindestens 2 Reviews vor Merge
3. **Automated Checks**: Schema-Validierung, Security-Scan
4. **Reporting**: Users können problematische Module melden
5. **Removal Process**: Schnelle Entfernung bei Problemen

---

## Technische Details

### Automerge Bridge

```typescript
// Intern: Wie useModule CRUD generiert

function generateCRUD(schema: ModuleSchema, docHandle: DocHandle) {
  const crud = {};

  for (const [entityName, entitySchema] of Object.entries(schema)) {
    crud[`create${capitalize(entityName)}`] = (data: any) => {
      docHandle.change((d) => {
        const id = generateId();
        const now = Date.now();

        // Auto-fill special fields
        const item = {
          id,
          ...data,
          createdAt: now,
          updatedAt: now,
          createdBy: getCurrentUserDid(),
        };

        // Validate against schema
        validateItem(item, entitySchema);

        // Insert into correct location
        if (entitySchema.type === 'collection') {
          d.data[moduleId][entityName][id] = item;
        } else if (entitySchema.type === 'map') {
          const key = resolveKey(entitySchema.key, item);
          d.data[moduleId][entityName][key] = item;
        }

        d.lastModified = now;
      });
    };

    // Similar for update, remove...
  }

  return crud;
}
```

### Type Generation

```typescript
// Aus Schema:
schema: {
  todos: {
    type: 'collection',
    fields: {
      text: 'string',
      done: 'boolean',
      createdBy: 'user',
    }
  }
}

// Generierte Types:
interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

interface TodoModuleData {
  todos: Record<string, Todo>;
}

interface TodoModuleCRUD {
  create: {
    todo: (data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
  };
  update: {
    todo: (id: string, data: Partial<Todo>) => void;
  };
  remove: {
    todo: (id: string) => void;
  };
}
```

---

## Zusammenfassung

### Was wir bauen

1. **@narrative/module-sdk**: Deklaratives SDK für Modul-Entwicklung
2. **create-narrative-module**: CLI zum Scaffolding
3. **Module Runtime**: Dynamisches Laden in UnifiedApp
4. **Module Marketplace**: In-App Discovery & Installation

### Warum es funktioniert

- **Für Vibe-Coder**: Schema definieren, React-Component bauen, fertig
- **Für Power-User**: Volle Kontrolle wenn nötig, Types, Custom Logic
- **Für die Community**: Einfaches Teilen, schnelle Iteration

### Nächste Schritte

1. Review dieses Konzepts
2. Priorisierung der Phasen
3. Start mit Phase 1 (Module SDK Foundation)

---

*Dokument erstellt: Dezember 2024*
*Status: Konzept zur Diskussion*
