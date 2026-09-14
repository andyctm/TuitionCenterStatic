import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';

const ACCESS_TOKEN_TTL = '15m'; // auth capability: 15 min access token TTL.

export type AccessTokenPayload = {
  sub: string;
  role: Role;
  branchIds: string[];
};

export class AccessTokenExpiredError extends Error {
  constructor() {
    super('Access token has expired');
  }
}

export class AccessTokenInvalidError extends Error {
  constructor() {
    super('Access token is invalid');
  }
}

export function signAccessToken(payload: AccessTokenPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload {
  try {
    return jwt.verify(token, secret) as jwt.JwtPayload & AccessTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AccessTokenExpiredError();
    }
    throw new AccessTokenInvalidError();
  }
}
