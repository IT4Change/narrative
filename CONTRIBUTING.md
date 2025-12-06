# Contributing to Narrative

Willkommen! Wir freuen uns über jeden Beitrag zum Narrative Web of Trust Ökosystem.

## Quick Start für neue Entwickler

### 1. Setup

```bash
git clone https://github.com/it4change/narrative.git
cd narrative
npm install
npm run build:lib   # Wichtig: Library muss zuerst gebaut werden!
npm run dev         # Alle Apps starten
```

### 2. Erste eigene App

```bash
npm run create-app my-app --port 3010 --title "My App"
npm install
npm run dev:my
```

Siehe [docs/TUTORIAL.md](docs/TUTORIAL.md) für ein vollständiges Tutorial.

## Projekt-Struktur

```
narrative/
├── lib/               # Shared Library (narrative-ui) - hier sind die meisten Änderungen
├── narrative-app/     # Assumptions App
├── map-app/           # Map App
├── market-app/        # Marketplace
├── dank-app/          # Voucher System
├── unified-app/       # All-in-One PWA
├── shared-config/     # Shared Build Config
├── scripts/           # Scaffolding
└── docs/              # Dokumentation
```

## Entwicklungs-Workflow

### Library entwickeln

```bash
# Watch-Mode für Live-Reload
npm run dev --workspace=lib

# Tests
npm run test --workspace=lib

# Build
npm run build:lib
```

**Wichtig**: Nach Library-Änderungen `npm run build:lib` ausführen, bevor Apps getestet werden.

### Apps entwickeln

```bash
npm run dev:narrative    # Narrative App
npm run dev:map          # Map App
npm run dev:market       # Market App
npm run dev:unified      # Unified App
```

### Tests ausführen

```bash
npm run test             # Library Tests
npm run lint             # Linting
```

## Code-Richtlinien

### TypeScript

- Strict Mode aktiviert
- Keine `any` Types (außer in speziellen Fällen)
- Interfaces für komplexe Typen

### React

- Functional Components mit Hooks
- `useDocHandle` / `useDocument` für Automerge
- Props als Interface definiert

### Automerge

```typescript
// ✅ Richtig: Direkte Mutation im change-Callback
docHandle.change((d) => {
  d.data.items.push(newItem);
  d.lastModified = Date.now();
});

// ❌ Falsch: Array ersetzen
docHandle.change((d) => {
  d.data.items = [...d.data.items, newItem];
});

// ❌ Falsch: Außerhalb von change mutieren
doc.data.items.push(newItem);
```

### Styling

- Tailwind CSS
- DaisyUI Components
- Responsive Design (Mobile-First)

## Pull Request Guidelines

### Vor dem PR

1. **Tests**: Stelle sicher, dass alle Tests bestehen
2. **Build**: `npm run build` muss durchlaufen
3. **Lint**: `npm run lint` ohne Fehler
4. **Commits**: Beschreibende Commit-Messages

### PR erstellen

1. Fork erstellen oder Branch anlegen
2. Änderungen committen
3. PR gegen `main` erstellen
4. PR-Beschreibung ausfüllen:
   - Was wurde geändert?
   - Warum?
   - Screenshots (bei UI-Änderungen)

### Review-Prozess

- PRs werden reviewed bevor sie gemerged werden
- CI muss grün sein (Tests, Build)
- Mindestens 1 Approval erforderlich

## Wo du helfen kannst

### Good First Issues

Suche nach Issues mit Label `good first issue` - diese sind für Einsteiger geeignet.

### Ideen für Beiträge

| Bereich | Beispiele |
|---------|-----------|
| **UI/UX** | Neue Components, Accessibility, Mobile |
| **Trust** | Transitive Trust, Block-Liste, Trust-Graph |
| **Apps** | Neue App-Ideen, Bugfixes |
| **Docs** | Tutorials, API-Docs, Übersetzungen |
| **Tests** | Unit Tests, Integration Tests |

## Architektur-Entscheidungen

### Warum Automerge?

- Offline-First ohne Server
- Real-time Collaboration
- Conflict-Free (CRDTs)

### Warum did:key?

- Dezentral (kein Registry)
- Self-Sovereign
- Mathematisch sicher (Ed25519)

### Warum signierte Profile/Attestations?

- Jeder kann in Automerge-Docs schreiben
- Signaturen schützen vor Manipulation
- Verifizierung bei Read-Time

## Kommunikation

- **Issues**: Bug Reports, Feature Requests
- **Discussions**: Allgemeine Fragen, Ideen
- **PRs**: Code-Beiträge

## LLM-Unterstützung

Für AI-Assistenten (Claude, ChatGPT) gibt es:

- **llms.txt** - Kompakte Referenz im Root
- **CLAUDE.md** - Detaillierter Development Guide

Diese Dateien helfen AI-Tools, den Code besser zu verstehen.

## Lizenz

MIT - siehe [LICENSE](LICENSE)

---

Danke für deinen Beitrag! 🙏
