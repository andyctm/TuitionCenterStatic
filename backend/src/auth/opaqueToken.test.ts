import { describe, expect, it } from 'vitest';
import { generateOpaqueToken, hashOpaqueToken } from './opaqueToken';

describe('opaque tokens', () => {
  it('generates a long, high-entropy opaque token (not a JWT)', () => {
    const token = generateOpaqueToken();

    expect(token.length).toBeGreaterThanOrEqual(43); // 32 random bytes, base64url-encoded
    expect(token).not.toContain('.'); // not a JWT structure
  });

  it('generates a different token each time', () => {
    expect(generateOpaqueToken()).not.toBe(generateOpaqueToken());
  });

  it('hashes deterministically so a stored hash can be looked up by re-hashing an incoming token', () => {
    const token = generateOpaqueToken();

    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });

  it('produces different hashes for different tokens', () => {
    expect(hashOpaqueToken(generateOpaqueToken())).not.toBe(hashOpaqueToken(generateOpaqueToken()));
  });
});
