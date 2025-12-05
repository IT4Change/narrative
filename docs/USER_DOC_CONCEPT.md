# User Document Konzept

## Motivation

Aktuell sind alle Daten an Workspace-Dokumente gebunden. Bestimmte Daten sind jedoch **User-zentriert** und sollten über Workspaces hinweg verfügbar sein:

- Identität (Name, Avatar)
- Trust-Attestations (Wem vertraue ich?)
- DANK-Vouchers (Meine Gutscheine)
- Workspace-Liste (Meine Workspaces)

## Aktueller Zustand

| Daten | Speicherort | Problem |
|-------|-------------|---------|
| Identity (DID, privateKey) | localStorage | Nicht synchronisiert zwischen Geräten |
| Identity (Name, Avatar) | localStorage + doc.identities | Dupliziert, inkonsistent |
| Workspace-Liste | localStorage | Nicht synchronisiert |
| Trust-Attestations | Workspace-Doc | An einzelnen Workspace gebunden |
| DANK-Vouchers | Workspace-Doc | An einzelnen Workspace gebunden |

## Ziel-Architektur

```
                    ┌─────────────────┐
                    │   User-Doc      │
                    │  (persönlich)   │
                    │                 │
                    │ - Identity      │
                    │ - Attestations  │
                    │ - Vouchers      │
                    │ - Workspaces    │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │ Workspace A │   │ Workspace B │   │ Workspace C │
    │             │   │             │   │             │
    │ Assumptions │   │ Locations   │   │ Offers      │
    └─────────────┘   └─────────────┘   └─────────────┘
```

## Ende-zu-Ende-Verschlüsselung (E2EE)

### Vision: Web of Trust mit schrittweiser Enthüllung

Von außen sieht niemand das Netzwerk. Erst wenn jemand sein Profil mit mir teilt, sehe ich:
1. Sein Profil (Name, Avatar)
2. Seine Trust-Attestations → Kontakte 2. Grades werden sichtbar
3. Durch diese wiederum Kontakte 3. Grades, usw.

### Beispiel

```
Außenseiter sieht:
┌─────────────────────────────────────┐
│  Alice: did:key:z6MkA...            │
│  Bob:   did:key:z6MkB...            │
│  Carol: did:key:z6MkC...            │
│                                     │
│  (Keine Verbindungen sichtbar!)     │
└─────────────────────────────────────┘

Alice sieht (nachdem Bob sein Profil geteilt hat):
┌─────────────────────────────────────┐
│  Alice ←→ Bob (1. Grad)             │
│            ↓                        │
│          Carol (2. Grad)            │
│            ↓                        │
│          Dave (3. Grad, encrypted)  │
└─────────────────────────────────────┘
```

### Datenschutz-Eigenschaften

| Was | Wer sieht es |
|-----|--------------|
| Dass eine DID existiert | Jeder (DID ist öffentlich) |
| Name/Avatar | Nur User + direkte Kontakte |
| Trust-Attestations | Nur User + direkte Kontakte |
| Vouchers | Nur User (+ Transaktionspartner) |
| Das gesamte Netzwerk | Niemand (nur lokale Sicht) |

### Technische Umsetzung

#### Basis-Schema (ohne Verschlüsselung)

```typescript
interface UserDocument {
  // Öffentlich (für Discovery)
  did: string;

  // Profil
  profile: {
    displayName: string;
    avatarUrl?: string;
  };

  // Trust-Attestations (Option A: bidirektional für Device-Sync)
  trustGiven: Record<string, TrustAttestation>;     // Von mir gegeben (signiert von mir)
  trustReceived: Record<string, TrustAttestation>;  // Von anderen erhalten (signiert vom Geber)

  // Weitere User-Daten
  vouchers: Record<string, Voucher>;
  workspaces: string[];  // Workspace-Doc-IDs
}

interface TrustAttestation {
  id: string;
  fromDid: string;      // Wer gibt das Vertrauen
  toDid: string;        // Wer erhält das Vertrauen
  level: 'trusted' | 'blocked';
  createdAt: number;
  signature: string;    // JWS-Signatur des Gebers (Spam-Schutz!)
}
```

#### Warum bidirektionale Trust-Speicherung (Option A)?

1. **Device-Sync**: Wenn ich den Cache lösche, kann ich mein UserDoc wiederherstellen und sehe alle erhaltenen Attestations
2. **Unabhängigkeit**: Ich bin nicht darauf angewiesen, dass andere online sind
3. **Signatur als Spam-Schutz**: Automerge hat keine Schreibrechte - jeder kann theoretisch in mein Doc schreiben. Aber:
   - Attestations ohne gültige Signatur werden ignoriert
   - Nur der echte Geber kann eine gültige Signatur erstellen
   - Verifizierung erfolgt beim Lesen, nicht beim Schreiben

#### Verschlüsseltes Schema (spätere Migration)

```typescript
interface EncryptedUserDocument {
  // Öffentlich (für Discovery)
  did: string;
  encryptionPublicKey: string;  // X25519 (für Verschlüsselung)

  // Verschlüsselt mit Content-Key
  encryptedEnvelope: {
    // Für jeden berechtigten Peer: Content-Key verschlüsselt mit Peer's Public Key
    keyWraps: {
      [peerDid: string]: string;
    };
    // Eigentlicher Inhalt, verschlüsselt mit Content-Key
    ciphertext: string;  // { profile, trustGiven, trustReceived, vouchers, workspaces }
  };
}
```

### Ablauf: User verifizieren sich gegenseitig

User teilen ihre Identität **out-of-band** (außerhalb des Systems):

```
QR-Code oder Link enthält:
┌─────────────────────────────────────────────────┐
│  did:key:z6MkpTHR8VNs...                        │
│  userDocId: automerge:4NMNnkMhL...              │
└─────────────────────────────────────────────────┘
```

**Ablauf: Alice und Bob vernetzen sich**

1. Alice zeigt Bob ihren QR-Code (enthält DID + UserDoc-ID)
2. Bob scannt den Code und lädt Alice's UserDoc
3. Bob sieht Alice's Profil (Name, Avatar)
4. Bob entscheidet: "Ich vertraue Alice"
5. Bob erstellt TrustAttestation, signiert sie mit seinem Private Key
6. Bob schreibt die Attestation in:
   - Sein eigenes UserDoc (`trustGiven[alice.did]`)
   - Alice's UserDoc (`trustReceived[bob.did]`)
7. Alice sieht jetzt Bob in ihrer Trust-Liste

**Signatur-Validierung beim Lesen:**
```typescript
function getValidTrustReceived(userDoc: UserDocument): TrustAttestation[] {
  return Object.values(userDoc.trustReceived)
    .filter(attestation => {
      // Nur Attestations mit gültiger Signatur akzeptieren
      const giverPublicKey = extractPublicKeyFromDid(attestation.fromDid);
      return verifySignature(attestation, giverPublicKey);
    });
}
```

### Ablauf: E2EE Profil-Sharing (spätere Migration)

1. Bob generiert Content-Key (symmetrisch, z.B. AES-256-GCM)
2. Bob verschlüsselt seinen Content mit Content-Key
3. Bob verschlüsselt Content-Key mit Alice's Public Key (X25519)
4. Bob fügt `keyWraps[alice.did] = encryptedContentKey` hinzu
5. Alice kann jetzt:
   - Ihren verschlüsselten Content-Key aus `keyWraps` holen
   - Mit ihrem Private Key entschlüsseln
   - Bob's Content entschlüsseln

### Offene Fragen (für E2EE-Migration)

1. **Key-Typ**: Ed25519 (Signatur) vs. X25519 (Verschlüsselung)
   - Option: Key-Derivation Ed25519 → X25519
   - Option: Separates Schlüsselpaar für Verschlüsselung

2. **Trust-Widerruf**: Wenn Bob Alice nicht mehr vertraut
   - Bob entfernt `keyWraps[alice.did]`
   - Alice hat aber noch den alten Content-Key
   - Lösung: Neuen Content-Key generieren, alle anderen Peers aktualisieren

3. **Automerge + Verschlüsselung**:
   - Verschlüsselte Felder können nicht gemerged werden
   - Last-Write-Wins für `encryptedEnvelope`
   - Oder: Client-side decrypt → merge → encrypt

## Nächste Schritte

1. ✅ Konzept dokumentieren (dieses Dokument)
2. ⏳ Basics fertigstellen (AppLayout, etc.)
3. ⏳ User-Doc Schema definieren (ohne Verschlüsselung zunächst)
4. ⏳ User-Doc in AppShell integrieren
5. ⏳ Verschlüsselung hinzufügen
