import type { Role } from '@prisma/client';

// Shape of req.auth, populated by requireAuth from the verified access-token payload.
export type AuthContext = { userId: string; role: Role; branchIds: string[] };
