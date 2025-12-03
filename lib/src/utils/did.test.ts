import { describe, it, expect } from 'vitest';
import {
  generateKeypair,
  deriveDidFromPublicKey,
  extractPublicKeyFromDid,
  isFakeDid,
  generateDidIdentity,
  base64Encode,
  base64Decode,
  isValidDid,
} from './did';

describe('generateKeypair', () => {
  it('should generate a keypair with public and private keys', async () => {
    const keypair = await generateKeypair();

    expect(keypair).toBeDefined();
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
  });

  it('should generate 32-byte Ed25519 public key', async () => {
    const keypair = await generateKeypair();

    // Ed25519 public keys are always 32 bytes
    expect(keypair.publicKey.length).toBe(32);
  });

  it('should generate PKCS#8 format private key', async () => {
    const keypair = await generateKeypair();

    // PKCS#8 Ed25519 private keys are 48 bytes (in browser environment)
    // Note: Node.js may produce different lengths (85 bytes)
    expect(keypair.privateKey.length).toBe(48);
  });

  it('should generate unique keypairs', async () => {
    const keypair1 = await generateKeypair();
    const keypair2 = await generateKeypair();

    // Public keys should be different
    expect(keypair1.publicKey).not.toEqual(keypair2.publicKey);
    expect(keypair1.privateKey).not.toEqual(keypair2.privateKey);
  });
});

describe('deriveDidFromPublicKey', () => {
  it('should generate did:key with correct format', async () => {
    const keypair = await generateKeypair();
    const did = deriveDidFromPublicKey(keypair.publicKey);

    // Format: did:key:z{base58btc-encoded-multicodec-pubkey}
    expect(did).toMatch(/^did:key:z[1-9A-HJ-NP-Za-km-z]+$/);
  });

  it('should start with did:key:z prefix', async () => {
    const keypair = await generateKeypair();
    const did = deriveDidFromPublicKey(keypair.publicKey);

    expect(did.startsWith('did:key:z')).toBe(true);
  });

  it('should generate consistent DID for same public key', async () => {
    const keypair = await generateKeypair();
    const did1 = deriveDidFromPublicKey(keypair.publicKey);
    const did2 = deriveDidFromPublicKey(keypair.publicKey);

    expect(did1).toBe(did2);
  });

  it('should generate different DIDs for different public keys', async () => {
    const keypair1 = await generateKeypair();
    const keypair2 = await generateKeypair();

    const did1 = deriveDidFromPublicKey(keypair1.publicKey);
    const did2 = deriveDidFromPublicKey(keypair2.publicKey);

    expect(did1).not.toBe(did2);
  });
});

describe('extractPublicKeyFromDid', () => {
  it('should extract public key from did:key', async () => {
    const keypair = await generateKeypair();
    const did = deriveDidFromPublicKey(keypair.publicKey);

    const extractedPubKey = extractPublicKeyFromDid(did);

    expect(extractedPubKey).toEqual(keypair.publicKey);
  });

  it('should roundtrip: publicKey -> DID -> publicKey', async () => {
    const keypair = await generateKeypair();
    const did = deriveDidFromPublicKey(keypair.publicKey);
    const extractedPubKey = extractPublicKeyFromDid(did);

    expect(extractedPubKey).toEqual(keypair.publicKey);
  });

  it('should throw error for invalid DID format', () => {
    expect(() => extractPublicKeyFromDid('invalid-did')).toThrow(
      'Invalid did:key format'
    );
  });

  it('should throw error for non-Ed25519 did:key', () => {
    // This is a fake did:key with wrong multicodec prefix
    const fakeDid = 'did:key:zABC123';

    expect(() => extractPublicKeyFromDid(fakeDid)).toThrow(
      'Not an Ed25519 did:key'
    );
  });

  it('should throw error for legacy fake DIDs', () => {
    const fakeDid = 'did:key:1234567890-abc123';

    expect(() => extractPublicKeyFromDid(fakeDid)).toThrow(
      'Invalid did:key format'
    );
  });
});

describe('isFakeDid', () => {
  it('should return false for valid did:key', async () => {
    const keypair = await generateKeypair();
    const did = deriveDidFromPublicKey(keypair.publicKey);

    expect(isFakeDid(did)).toBe(false);
  });

  it('should return true for legacy timestamp-random DIDs', () => {
    const fakeDid = 'did:key:1234567890-abc123';

    expect(isFakeDid(fakeDid)).toBe(true);
  });

  it('should return true for DIDs without z prefix', () => {
    const fakeDid = 'did:key:ABC123';

    expect(isFakeDid(fakeDid)).toBe(true);
  });

  it('should return true for non-did:key formats', () => {
    expect(isFakeDid('did:web:example.com')).toBe(true);
    expect(isFakeDid('not-a-did')).toBe(true);
    expect(isFakeDid('')).toBe(true);
  });

  it('should return true for DIDs with hyphen (old format)', () => {
    // Legacy format: did:key:{timestamp}-{random}
    expect(isFakeDid('did:key:z1234-5678')).toBe(true);
  });
});

describe('generateDidIdentity', () => {
  it('should generate complete DID identity', async () => {
    const identity = await generateDidIdentity('Test User');

    expect(identity.did).toMatch(/^did:key:z[1-9A-HJ-NP-Za-km-z]+$/);
    expect(identity.publicKey).toBeTruthy();
    expect(identity.privateKey).toBeTruthy();
    expect(identity.displayName).toBe('Test User');
  });

  it('should generate identity without display name', async () => {
    const identity = await generateDidIdentity();

    expect(identity.did).toBeDefined();
    expect(identity.publicKey).toBeDefined();
    expect(identity.privateKey).toBeDefined();
    expect(identity.displayName).toBeUndefined();
  });

  it('should generate unique identities', async () => {
    const identity1 = await generateDidIdentity();
    const identity2 = await generateDidIdentity();

    expect(identity1.did).not.toBe(identity2.did);
    expect(identity1.publicKey).not.toBe(identity2.publicKey);
    expect(identity1.privateKey).not.toBe(identity2.privateKey);
  });

  it('should generate base64-encoded keys', async () => {
    const identity = await generateDidIdentity();

    // Base64 should only contain valid characters
    expect(identity.publicKey).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(identity.privateKey).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

describe('base64Encode', () => {
  it('should encode Uint8Array to base64', () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const encoded = base64Encode(data);

    expect(encoded).toBe('SGVsbG8=');
  });

  it('should handle empty array', () => {
    const data = new Uint8Array([]);
    const encoded = base64Encode(data);

    expect(encoded).toBe('');
  });

  it('should handle arbitrary binary data', () => {
    const data = new Uint8Array([0, 1, 2, 255, 254, 253]);
    const encoded = base64Encode(data);

    expect(encoded).toBeTruthy();
    expect(typeof encoded).toBe('string');
  });
});

describe('base64Decode', () => {
  it('should decode base64 to Uint8Array', () => {
    const decoded = base64Decode('SGVsbG8=');

    expect(decoded).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });

  it('should handle empty string', () => {
    const decoded = base64Decode('');

    expect(decoded).toEqual(new Uint8Array([]));
  });

  it('should roundtrip: encode -> decode', () => {
    const original = new Uint8Array([0, 1, 2, 255, 254, 253]);
    const encoded = base64Encode(original);
    const decoded = base64Decode(encoded);

    expect(decoded).toEqual(original);
  });
});

describe('isValidDid', () => {
  it('should return true for valid did:key', async () => {
    const keypair = await generateKeypair();
    const did = deriveDidFromPublicKey(keypair.publicKey);

    expect(isValidDid(did)).toBe(true);
  });

  it('should return false for fake DIDs', () => {
    expect(isValidDid('did:key:1234567890-abc123')).toBe(false);
  });

  it('should return false for invalid formats', () => {
    expect(isValidDid('not-a-did')).toBe(false);
    expect(isValidDid('')).toBe(false);
    expect(isValidDid('did:web:example.com')).toBe(false);
  });

  it('should return false for malformed did:key', () => {
    expect(isValidDid('did:key:zINVALID')).toBe(false);
  });

  it('should validate DID can be decoded', async () => {
    const keypair = await generateKeypair();
    const validDid = deriveDidFromPublicKey(keypair.publicKey);

    // Valid DID should pass
    expect(isValidDid(validDid)).toBe(true);

    // Truncated DID should fail
    const truncatedDid = validDid.slice(0, -5);
    expect(isValidDid(truncatedDid)).toBe(false);
  });
});
