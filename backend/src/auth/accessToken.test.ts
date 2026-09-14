import { describe, expect, it, vi } from 'vitest';
import {
  AccessTokenExpiredError,
  AccessTokenInvalidError,
  signAccessToken,
  verifyAccessToken,
} from './accessToken';

const secret = 'test-access-secret';
const payload = { sub: 'user_1', role: 'TEACHER' as const, branchIds: ['branch_1'] };

describe('access tokens', () => {
  it('round-trips: a signed token verifies back to the same payload', () => {
    const token = signAccessToken(payload, secret);
    const decoded = verifyAccessToken(token, secret);

    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.branchIds).toEqual(payload.branchIds);
  });

  it('rejects a token signed with a different secret', () => {
    const token = signAccessToken(payload, 'a-different-secret');

    expect(() => verifyAccessToken(token, secret)).toThrow(AccessTokenInvalidError);
  });

  it('rejects a token past its expiry (15 min TTL per the auth capability)', () => {
    vi.useFakeTimers();
    const token = signAccessToken(payload, secret);

    vi.advanceTimersByTime(16 * 60 * 1000);

    expect(() => verifyAccessToken(token, secret)).toThrow(AccessTokenExpiredError);
    vi.useRealTimers();
  });
});
