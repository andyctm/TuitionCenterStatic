import { createApp } from './app';
import { createAuthService } from './auth/authService';
import { parseEnv } from './env';
import { prisma } from './lib/prisma';
import { createPrismaPasswordResetTokenRepository } from './repositories/prismaPasswordResetTokenRepository';
import { createPrismaRefreshTokenRepository } from './repositories/prismaRefreshTokenRepository';
import { createPrismaUserRepository } from './repositories/prismaUserRepository';
import { createUsersService } from './users/usersService';

const env = parseEnv(process.env);

const userRepo = createPrismaUserRepository(prisma);
const refreshTokenRepo = createPrismaRefreshTokenRepository(prisma);
const passwordResetTokenRepo = createPrismaPasswordResetTokenRepository(prisma);

const authService = createAuthService({
  userRepo,
  refreshTokenRepo,
  passwordResetTokenRepo,
  accessTokenSecret: env.jwtAccessSecret,
  sendPasswordResetEmail: async (email, token) => {
    // TODO(M1 follow-up): wire a real transactional email provider using env.emailApiKey.
    console.log(`[password-reset] would email ${email} a reset token: ${token}`);
  },
});
const usersService = createUsersService({ userRepo });

const app = createApp({
  allowedOrigins: env.allowedOrigins,
  checkDb: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
  authService,
  usersService,
  accessTokenSecret: env.jwtAccessSecret,
});

app.listen(env.port, () => {
  console.log(`TCMS API listening on port ${env.port}`);
});
