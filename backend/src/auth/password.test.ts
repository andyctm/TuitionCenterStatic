import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('round-trips: a hash of a password verifies against that same password', async () => {
    const hash = await hashPassword('correct horse battery staple');

    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('never equals the plaintext password', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).not.toBe('correct horse battery staple');
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');

    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('uses a cost factor of at least 12 (FR-AUTH-2 / auth capability)', async () => {
    const hash = await hashPassword('correct horse battery staple');
    // bcrypt hash format: $2a$<cost>$<salt+hash> — extract the cost factor.
    const cost = Number(hash.split('$')[2]);

    expect(cost).toBeGreaterThanOrEqual(12);
  });
});
