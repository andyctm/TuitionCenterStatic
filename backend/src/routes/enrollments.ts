import { Router } from 'express';
import type { EnrollmentService } from '../enrollment/enrollmentService';
import { AppError } from '../errors/AppError';
import { getAuthContext } from '../lib/authContext';
import { asyncHandler } from '../lib/asyncHandler';
import { parseBody } from '../lib/validate';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import {
  createEnrollmentSchema,
  enrollmentListQuerySchema,
  updateEnrollmentStatusSchema,
} from '../validation/enrollmentSchemas';

const LIST_ROLES = ['SUPER_ADMIN', 'CENTER_ADMIN', 'ACCOUNTANT', 'STUDENT', 'PARENT'] as const;
const WRITE_ROLES = ['SUPER_ADMIN', 'CENTER_ADMIN', 'ACCOUNTANT'] as const;

export function createEnrollmentsRouter(
  enrollmentService: EnrollmentService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const authed = requireAuth(accessTokenSecret);
  const listAccess = [authed, requireRole(...LIST_ROLES)];
  const writeAccess = [authed, requireRole(...WRITE_ROLES)];

  router.get(
    '/',
    ...listAccess,
    asyncHandler(async (req, res) => {
      const query = parseBody(enrollmentListQuerySchema, req.query);
      const enrollments = await enrollmentService.list(getAuthContext(req), query);
      res.status(200).json({ data: enrollments });
    }),
  );

  router.post(
    '/',
    ...writeAccess,
    asyncHandler(async (req, res) => {
      const input = parseBody(createEnrollmentSchema, req.body);
      const enrollment = await enrollmentService.create(getAuthContext(req), input);
      res.status(201).json({ data: enrollment });
    }),
  );

  router.patch(
    '/:id',
    ...writeAccess,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (typeof id !== 'string') {
        throw new AppError('NOT_FOUND', 404, 'Enrollment not found');
      }
      const { status } = parseBody(updateEnrollmentStatusSchema, req.body);
      const enrollment = await enrollmentService.updateStatus(getAuthContext(req), id, status);
      res.status(200).json({ data: enrollment });
    }),
  );

  return router;
}
