import { createApp } from './app';
import { parseEnv } from './env';
import { prisma } from './lib/prisma';

const env = parseEnv(process.env);

const app = createApp({
  allowedOrigins: env.allowedOrigins,
  checkDb: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
});

app.listen(env.port, () => {
  console.log(`TCMS API listening on port ${env.port}`);
});
