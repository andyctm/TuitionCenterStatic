import { Router } from 'express';
import type { SubjectsService } from '../academic/subjectsService';
import type { GradeLevelsService } from '../academic/gradeLevelsService';
import type { CoursesService } from '../academic/coursesService';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../lib/asyncHandler';
import { parseBody } from '../lib/validate';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import {
  createCourseSchema,
  createGradeLevelSchema,
  createSubjectSchema,
  updateCourseSchema,
} from '../validation/academicSchemas';

// academic-structure capability: Subjects/GradeLevels/Courses are readable by any
// authenticated user, writable only by Super Admin / Center Admin.
const WRITE_ROLES = ['SUPER_ADMIN', 'CENTER_ADMIN'] as const;

export function createSubjectsRouter(
  subjectsService: SubjectsService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const authed = requireAuth(accessTokenSecret);

  router.get(
    '/',
    authed,
    asyncHandler(async (_req, res) => {
      res.status(200).json({ data: await subjectsService.list() });
    }),
  );

  router.post(
    '/',
    authed,
    requireRole(...WRITE_ROLES),
    asyncHandler(async (req, res) => {
      const input = parseBody(createSubjectSchema, req.body);
      const subject = await subjectsService.create(input);
      res.status(201).json({ data: subject });
    }),
  );

  return router;
}

export function createGradeLevelsRouter(
  gradeLevelsService: GradeLevelsService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const authed = requireAuth(accessTokenSecret);

  router.get(
    '/',
    authed,
    asyncHandler(async (_req, res) => {
      res.status(200).json({ data: await gradeLevelsService.list() });
    }),
  );

  router.post(
    '/',
    authed,
    requireRole(...WRITE_ROLES),
    asyncHandler(async (req, res) => {
      const input = parseBody(createGradeLevelSchema, req.body);
      const gradeLevel = await gradeLevelsService.create(input);
      res.status(201).json({ data: gradeLevel });
    }),
  );

  return router;
}

export function createCoursesRouter(
  coursesService: CoursesService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const authed = requireAuth(accessTokenSecret);
  const writeAccess = [authed, requireRole(...WRITE_ROLES)];

  router.get(
    '/',
    authed,
    asyncHandler(async (_req, res) => {
      res.status(200).json({ data: await coursesService.list() });
    }),
  );

  router.post(
    '/',
    ...writeAccess,
    asyncHandler(async (req, res) => {
      const input = parseBody(createCourseSchema, req.body);
      const course = await coursesService.create(input);
      res.status(201).json({ data: course });
    }),
  );

  router.patch(
    '/:id',
    ...writeAccess,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (typeof id !== 'string') {
        throw new AppError('NOT_FOUND', 404, 'Course not found');
      }
      const input = parseBody(updateCourseSchema, req.body);
      const course = await coursesService.update(id, input);
      res.status(200).json({ data: course });
    }),
  );

  router.delete(
    '/:id',
    ...writeAccess,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (typeof id !== 'string') {
        throw new AppError('NOT_FOUND', 404, 'Course not found');
      }
      await coursesService.delete(id);
      res.status(204).send();
    }),
  );

  return router;
}
