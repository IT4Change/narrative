import { describe, it, expect } from 'vitest';
import {
  signJws,
  verifyJws,
  extractJwsPayload,
  signEntity,
  verifyEntitySignature,
} from './signature';
import { generateDidIdentity, base64Encode } from './did';

describe('signJws', () => {
  it('should sign a payload and return JWS compact format', async () => {
    const identity = await generateDidIdentity('Test User');
    const payload = { message: 'Hello World', timestamp: Date.now() };

    const jws = await signJws(payload, identity.privateKey);

    // JWS compact format: header.payload.signature
    expect(jws).toBeTruthy();
    const parts = jws.split('.');
    expect(parts.length).toBe(3);
  });

  it('should generate different signatures for different payloads', async () => {
    const identity = await generateDidIdentity('Test User');
    const payload1 = { message: 'Hello' };
    const payload2 = { message: 'World' };

    const jws1 = await signJws(payload1, identity.privateKey);
    const jws2 = await signJws(payload2, identity.privateKey);

    expect(jws1).not.toBe(jws2);
  });

  it('should generate different signatures with different keys', async () => {
    const identity1 = await generateDidIdentity('User 1');
    const identity2 = await generateDidIdentity('User 2');
    const payload = { message: 'Same message' };

    const jws1 = await signJws(payload, identity1.privateKey);
    const jws2 = await signJws(payload, identity2.privateKey);

    expect(jws1).not.toBe(jws2);
  });
});

describe('verifyJws', () => {
  it('should verify a valid JWS signature', async () => {
    const identity = await generateDidIdentity('Test User');
    const payload = { message: 'Hello World', timestamp: 12345 };

    const jws = await signJws(payload, identity.privateKey);
    const result = await verifyJws(jws, identity.publicKey);

    expect(result.valid).toBe(true);
    expect(result.payload).toEqual(payload);
    expect(result.error).toBeUndefined();
  });

  it('should reject signature from wrong public key', async () => {
    const identity1 = await generateDidIdentity('User 1');
    const identity2 = await generateDidIdentity('User 2');
    const payload = { message: 'Hello' };

    // Sign with identity1's private key
    const jws = await signJws(payload, identity1.privateKey);

    // Try to verify with identity2's public key
    const result = await verifyJws(jws, identity2.publicKey);

    expect(result.valid).toBe(false);
  });

  it('should reject tampered JWS payload', async () => {
    const identity = await generateDidIdentity('Test User');
    const payload = { message: 'Original' };

    const jws = await signJws(payload, identity.privateKey);

    // Tamper with the payload part (middle section)
    const parts = jws.split('.');
    // Modify the payload by changing a character
    const tamperedJws = `${parts[0]}.${parts[1].slice(0, -1)}X.${parts[2]}`;

    const result = await verifyJws(tamperedJws, identity.publicKey);

    expect(result.valid).toBe(false);
  });

  it('should reject invalid JWS format', async () => {
    const identity = await generateDidIdentity('Test User');

    const result = await verifyJws('invalid-jws-string', identity.publicKey);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid JWS format');
  });

  it('should reject JWS with only two parts', async () => {
    const identity = await generateDidIdentity('Test User');

    const result = await verifyJws('header.payload', identity.publicKey);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid JWS format');
  });
});

describe('extractJwsPayload', () => {
  it('should extract payload without verification', async () => {
    const identity = await generateDidIdentity('Test User');
    const payload = { message: 'Hello', count: 42 };

    const jws = await signJws(payload, identity.privateKey);
    const extracted = extractJwsPayload(jws);

    expect(extracted).toEqual(payload);
  });

  it('should return null for invalid JWS', () => {
    expect(extractJwsPayload('invalid')).toBeNull();
    expect(extractJwsPayload('')).toBeNull();
    expect(extractJwsPayload('a.b')).toBeNull();
  });
});

describe('signEntity', () => {
  it('should sign an entity and return JWS', async () => {
    const identity = await generateDidIdentity('Test User');
    const entity = {
      id: 'test-123',
      message: 'Hello',
      createdAt: Date.now(),
    };

    const signature = await signEntity(entity, identity.privateKey);

    expect(signature).toBeTruthy();
    expect(signature.split('.').length).toBe(3);
  });

  it('should exclude metadata fields from signature', async () => {
    const identity = await generateDidIdentity('Test User');
    const entityWithMeta = {
      id: 'test-123',
      message: 'Hello',
      signature: 'old-signature', // Should be excluded
      publicKey: 'some-key',      // Should be excluded
    };
    const entityWithoutMeta = {
      id: 'test-123',
      message: 'Hello',
    };

    const sig1 = await signEntity(entityWithMeta, identity.privateKey);
    const sig2 = await signEntity(entityWithoutMeta, identity.privateKey);

    // Both should produce the same signature since metadata is excluded
    expect(sig1).toBe(sig2);
  });

  it('should exclude mutable display name fields', async () => {
    const identity = await generateDidIdentity('Test User');
    const entityWithNames = {
      id: 'test-123',
      voterDid: identity.did,
      voterName: 'Alice',         // Should be excluded
      creatorName: 'Bob',         // Should be excluded
      editorName: 'Charlie',      // Should be excluded
    };
    const entityWithoutNames = {
      id: 'test-123',
      voterDid: identity.did,
    };

    const sig1 = await signEntity(entityWithNames, identity.privateKey);
    const sig2 = await signEntity(entityWithoutNames, identity.privateKey);

    // Both should produce the same signature since display names are excluded
    expect(sig1).toBe(sig2);
  });
});

describe('verifyEntitySignature', () => {
  it('should verify a valid entity signature', async () => {
    const identity = await generateDidIdentity('Test User');
    const entity = {
      id: 'test-123',
      trusterDid: identity.did,
      trusteeDid: 'did:key:z6MkOther...',
      createdAt: Date.now(),
    };

    const signature = await signEntity(entity, identity.privateKey);
    const signedEntity = { ...entity, signature };

    const result = await verifyEntitySignature(signedEntity, identity.publicKey);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject entity without signature', async () => {
    const identity = await generateDidIdentity('Test User');
    const entity = {
      id: 'test-123',
      message: 'Hello',
    };

    const result = await verifyEntitySignature(entity, identity.publicKey);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('No signature found');
  });

  it('should reject signature from wrong key', async () => {
    const identity1 = await generateDidIdentity('User 1');
    const identity2 = await generateDidIdentity('User 2');
    const entity = {
      id: 'test-123',
      message: 'Hello',
    };

    // Sign with identity1
    const signature = await signEntity(entity, identity1.privateKey);
    const signedEntity = { ...entity, signature };

    // Verify with identity2
    const result = await verifyEntitySignature(signedEntity, identity2.publicKey);

    expect(result.valid).toBe(false);
  });

  it('should reject modified entity', async () => {
    const identity = await generateDidIdentity('Test User');
    const entity = {
      id: 'test-123',
      message: 'Original',
    };

    const signature = await signEntity(entity, identity.privateKey);
    const modifiedEntity = {
      ...entity,
      message: 'Tampered',  // Changed!
      signature,
    };

    const result = await verifyEntitySignature(modifiedEntity, identity.publicKey);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Payload mismatch');
  });

  it('should allow mutable display name changes', async () => {
    const identity = await generateDidIdentity('Test User');
    const entity = {
      id: 'test-123',
      voterDid: identity.did,
      voterName: 'Alice',
    };

    const signature = await signEntity(entity, identity.privateKey);
    const entityWithChangedName = {
      ...entity,
      voterName: 'Alice (updated)', // Changed display name
      signature,
    };

    const result = await verifyEntitySignature(entityWithChangedName, identity.publicKey);

    // Should still be valid since display names are excluded from signature
    expect(result.valid).toBe(true);
  });
});

describe('TrustAttestation signature flow', () => {
  it('should sign and verify a trust attestation', async () => {
    const truster = await generateDidIdentity('Alice');
    const trustee = await generateDidIdentity('Bob');

    // Create trust attestation
    const attestation = {
      id: `trust-${Date.now()}`,
      trusterDid: truster.did,
      trusteeDid: trustee.did,
      trusterUserDocUrl: 'automerge:abc123',
      createdAt: Date.now(),
    };

    // Sign with truster's private key
    const signature = await signEntity(attestation, truster.privateKey);
    const signedAttestation = { ...attestation, signature };

    // Verify with truster's public key
    const result = await verifyEntitySignature(signedAttestation, truster.publicKey);

    expect(result.valid).toBe(true);
  });

  it('should reject attestation signed by wrong party', async () => {
    const alice = await generateDidIdentity('Alice');
    const bob = await generateDidIdentity('Bob');
    const mallory = await generateDidIdentity('Mallory');

    // Create attestation claiming Alice trusts Bob
    const attestation = {
      id: `trust-${Date.now()}`,
      trusterDid: alice.did,  // Claims to be from Alice
      trusteeDid: bob.did,
      createdAt: Date.now(),
    };

    // But Mallory signs it (forgery attempt!)
    const signature = await signEntity(attestation, mallory.privateKey);
    const forgedAttestation = { ...attestation, signature };

    // Verify with Alice's public key (the claimed truster)
    const result = await verifyEntitySignature(forgedAttestation, alice.publicKey);

    // Should fail because Mallory's signature doesn't match Alice's public key
    expect(result.valid).toBe(false);
  });

  it('should handle bidirectional trust flow', async () => {
    const alice = await generateDidIdentity('Alice');
    const bob = await generateDidIdentity('Bob');

    // Alice creates attestation trusting Bob
    const aliceTrustsBob = {
      id: `trust-alice-bob`,
      trusterDid: alice.did,
      trusteeDid: bob.did,
      createdAt: Date.now(),
    };
    const aliceSignature = await signEntity(aliceTrustsBob, alice.privateKey);
    const signedAliceTrustsBob = { ...aliceTrustsBob, signature: aliceSignature };

    // Bob creates attestation trusting Alice
    const bobTrustsAlice = {
      id: `trust-bob-alice`,
      trusterDid: bob.did,
      trusteeDid: alice.did,
      createdAt: Date.now(),
    };
    const bobSignature = await signEntity(bobTrustsAlice, bob.privateKey);
    const signedBobTrustsAlice = { ...bobTrustsAlice, signature: bobSignature };

    // Verify both attestations
    const aliceResult = await verifyEntitySignature(signedAliceTrustsBob, alice.publicKey);
    const bobResult = await verifyEntitySignature(signedBobTrustsAlice, bob.publicKey);

    expect(aliceResult.valid).toBe(true);
    expect(bobResult.valid).toBe(true);

    // Cross-verify should fail (Alice's signature with Bob's key)
    const crossResult = await verifyEntitySignature(signedAliceTrustsBob, bob.publicKey);
    expect(crossResult.valid).toBe(false);
  });
});
