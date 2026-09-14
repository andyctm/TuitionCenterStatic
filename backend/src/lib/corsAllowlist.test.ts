import { describe, expect, it } from 'vitest';
import { isOriginAllowed } from './corsAllowlist';

describe('isOriginAllowed', () => {
  const allowed = ['https://acme.github.io', 'http://localhost:5500'];

  it('allows an origin present in the allow-list', () => {
    expect(isOriginAllowed('https://acme.github.io', allowed)).toBe(true);
  });

  it('rejects an origin not present in the allow-list', () => {
    expect(isOriginAllowed('https://evil.example.com', allowed)).toBe(false);
  });

  it('rejects a same-domain-looking but different-origin attempt (subdomain confusion)', () => {
    expect(isOriginAllowed('https://acme.github.io.evil.com', allowed)).toBe(false);
  });

  it('never allows a wildcard match, even if "*" is accidentally included in the list', () => {
    expect(isOriginAllowed('https://anything.example.com', ['*'])).toBe(false);
  });

  it('allows requests with no Origin header (same-machine tools like curl/health checks)', () => {
    expect(isOriginAllowed(undefined, allowed)).toBe(true);
  });
});
