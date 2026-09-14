import { createApp } from './app';
import { createAuthService } from './auth/authService';
import { parseEnv } from './env';
import { prisma } from './lib/prisma';
import { createPrismaPasswordResetTokenRepository } from './repositories/prismaPasswordResetTokenRepository';
import { createPrismaRefreshTokenRepository } from './repositories/prismaRefreshTokenRepository';
import { createPrismaUserRepository } from './repositories/prismaUserRepository';
import { createPrismaBranchRepository } from './repositories/prismaBranchRepository';
import { createPrismaSubjectRepository } from './repositories/prismaSubjectRepository';
import { createPrismaGradeLevelRepository } from './repositories/prismaGradeLevelRepository';
import { createPrismaCourseRepository } from './repositories/prismaCourseRepository';
import { createPrismaBatchRepository } from './repositories/prismaBatchRepository';
import { createPrismaClassScheduleRepository } from './repositories/prismaClassScheduleRepository';
import { createUsersService } from './users/usersService';
import { createBranchesService } from './branches/branchesService';
import { createSubjectsService } from './academic/subjectsService';
import { createGradeLevelsService } from './academic/gradeLevelsService';
import { createCoursesService } from './academic/coursesService';
import { createBatchesService } from './academic/batchesService';

const env = parseEnv(process.env);

const userRepo = createPrismaUserRepository(prisma);
const refreshTokenRepo = createPrismaRefreshTokenRepository(prisma);
const passwordResetTokenRepo = createPrismaPasswordResetTokenRepository(prisma);
const branchRepo = createPrismaBranchRepository(prisma);
const subjectRepo = createPrismaSubjectRepository(prisma);
const gradeLevelRepo = createPrismaGradeLevelRepository(prisma);
const courseRepo = createPrismaCourseRepository(prisma);
const batchRepo = createPrismaBatchRepository(prisma);
const classScheduleRepo = createPrismaClassScheduleRepository(prisma);

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
const branchesService = createBranchesService({ branchRepo });
const subjectsService = createSubjectsService({ subjectRepo });
const gradeLevelsService = createGradeLevelsService({ gradeLevelRepo });
const coursesService = createCoursesService({ courseRepo, subjectRepo, gradeLevelRepo });
const batchesService = createBatchesService({ batchRepo, courseRepo, branchRepo, classScheduleRepo });

const app = createApp({
  allowedOrigins: env.allowedOrigins,
  checkDb: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
  authService,
  usersService,
  branchesService,
  subjectsService,
  gradeLevelsService,
  coursesService,
  batchesService,
  accessTokenSecret: env.jwtAccessSecret,
});

app.listen(env.port, () => {
  console.log(`TCMS API listening on port ${env.port}`);
});
