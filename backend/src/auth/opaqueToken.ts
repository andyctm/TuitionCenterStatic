import { createHash, randomBytes } from 'node:crypto';

// Generic opaque-token helper shared by RefreshToken and PasswordResetToken — both are random,
// bearer-style secrets whose hash (not the raw value) is persisted.
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
