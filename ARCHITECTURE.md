# Architekturüberblick – Narrative

## Pakete & Laufzeit
- **Workspace:** `app/` (React/Vite UI) und `lib/` (`narrative-ui`, enthält Datenmodell, Hooks, DID-Utils).
- **Frontend-Stack:** React 18, Vite, TypeScript, DaisyUI/Tailwind für UI, Boring Avatars für Avatare.
- **CRDT/Sync:** Automerge 2.x + `automerge-repo` mit:
  - Storage: IndexedDB (`IndexedDBStorageAdapter`)
  - Netzwerk: WebSocket-Relay `wss://sync.automerge.org` (`BrowserWebSocketClientAdapter`)
  - BroadcastChannel-Adapter aktuell auskommentiert (siehe `app/src/App.tsx`).
- **Lokaler Zustand:** `useOpinionGraph` (aus `lib/`) kapselt alle CRDT-Reads/Writes.

## Datenmodell (lib/src/schema/index.ts)
- `UserIdentity`: `did`, optional `displayName`, `avatarUrl`, `publicKey`.
- `IdentityProfile` (pro DID): `displayName`, `avatarUrl`.
- `Assumption`: `id`, `sentence`, `createdBy`, `creatorName?`, Timestamps, `tagIds[]`, `voteIds[]`, `editLogIds[]`.
- `Vote`: `id`, `assumptionId`, `voterDid`, `voterName?`, `value (green|yellow|red)`, Timestamps.
- `Tag`: `id`, `name`, optional `color`, `createdBy`, `createdAt`.
- `EditEntry`: `id`, `assumptionId`, `editorDid`, `editorName?`, `type ('create'|'edit')`, `previousSentence`, `newSentence`, `previousTags?`, `newTags?`, `createdAt`.
- `OpinionGraphDoc`: `{ identity, identities, assumptions, votes, tags, edits, version, lastModified }`.

## Identität & DIDs
- Generierung über `lib/src/utils/did.ts`: Ed25519-Keypair (WebCrypto), `did:key` abgeleitet via multicodec + base58btc.
- `NarrativeApp` speichert Identity in `localStorage (narrativeIdentity)` inkl. `privateKey` (Base64), `publicKey`, `displayName`.
- Fake/Legacy-DIDs werden erkannt und verworfen (`isFakeDid`), anschließend Re-Gen.
- Hinweis: Schlüssel liegen unverschlüsselt im LocalStorage → nur Demo/Prototyp, keine Härtung.

## Sync-Verhalten
- Repo-Verbindung zu `wss://sync.automerge.org`, alle Peers mit Doc-ID können lesen/schreiben (kein ACL).
- Docs leben im Browser (IndexedDB) und werden beim Start aus URL-Hash (`#doc=...`) oder LocalStorage geladen.
- „New Board“ erzeugt neues Automerge-Dokument, setzt neuen Hash und behält History-Back zum alten Doc.

## Mutationen (useOpinionGraph)
- `createAssumption(sentence, tags)`: erstellt Assumption + Tags (reused via Name), legt `create`-EditLog mit Tags an.
- `updateAssumption(id, sentence, tags)`: schreibt neue Tags/Satz, erstellt `edit`-Entry mit vorher/nachher (Text/Tags).
- `setVote/removeVote`: ein Vote pro DID; speichert `voterName` Snapshot.
- `createTag`, `addTagToAssumption`, `removeTagFromAssumption`.
- `updateIdentity`: schreibt Namen in `identities[currentUserDid]`, propagiert auf eigene Votes.
- Helper: `getVoteSummary`, `getVotesForAssumption`, `getEditsForAssumption`.

## UI-Flows (Kurz)
- Identity-Modal: Name setzen, Export/Import, Reset ID.
- Boards: New Board (Navbar), Back führt zum alten Board (History).
- Assumptions: Create/Edit (gleicher Dialog mit Tags), Activity-Log (Votes + Edits, inkl. Tag-Änderungen, „＋“ für Create, „✎“ für Edit).
- Tags: Filter durch Klick auf Tag-Badge, Filter-Badge sticky über dem Content, Removal per ✕.
- Import: JSON-Import als FAB unten links (Array aus Strings oder `{ sentence, tags }`).

## Sicherheit / Signaturen / ACL
- **Signaturen (JWS, Ed25519):**
  - Entities (Assumptions, Edits, Votes) werden bei Erstellung/Änderung signiert, wenn ein privater Schlüssel vorliegt (`signEntity` in `lib/src/utils/signature.ts`).
  - `useOpinionGraph` generiert vollständige Payloads (mit Tag-IDs) und hängt `signature` an, bevor sie im Doc landen.
  - Öffentliche Schlüssel werden pro DID in `doc.identities[did].publicKey` abgelegt, um Verifikation zu ermöglichen.
- **Keine serverseitige AuthZ / ACL:** jeder mit Doc-ID + Relay-Zugang kann lesen/schreiben; Verifikation/Policies sind clientseitig zu ergänzen.
- **Kein E2EE:** Inhalte liegen Klartext im Relay; Zugangskontrolle nur über Geheimhaltung der Doc-ID.
- Für Härtung zusätzlich nötig:
  - Durchgängige Verifikation der Signaturen beim Rendern/Verarbeiten und Verwerfen ungültiger Einträge.
  - Policy/ACL (Self-Edits nur für eigene Felder, Votes nur vom Voter, etc.) und „validierte Sicht“.
  - Privater Relay oder E2EE, wenn Inhalte vertraulich sein sollen.

## Wichtige Bibliotheken/APIs
- Automerge/Repo (`@automerge/automerge`, `@automerge/automerge-repo`, React Hooks).
- Netzwerk/Storage: `automerge-repo-network-websocket`, `automerge-repo-storage-indexeddb`.
- DID/Keypair: Web Crypto API (Ed25519), `multiformats` für base58btc.
- Build/Styling: Vite, Tailwind/DaisyUI, React.

## Bekannte Grenzen
- Kein ACL/Signatur-Enforcement → mutative Aktionen sind vertrauensbasiert.
- Keymaterial im LocalStorage (ohne Verschlüsselung).
- Öffentlicher Relay → Doc-Inhalte sind für jeden mit Doc-ID sichtbar/veränderbar.
