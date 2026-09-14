import type { BatchStatus, EnrollmentStatus, Role, UserStatus } from '@prisma/client';

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  branchId: string | null;
};

export type NewUserInput = {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  branchId?: string | null;
};

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: NewUserInput): Promise<UserRecord>;
  updateStatus(id: string, status: UserStatus): Promise<UserRecord>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
}

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export interface RefreshTokenRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export interface PasswordResetTokenRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetTokenRecord>;
  findByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  markUsed(id: string): Promise<void>;
}

export type BranchRecord = {
  id: string;
  name: string;
  timezone: string;
  isActive: boolean;
};

export type NewBranchInput = {
  name: string;
  timezone?: string;
};

export type UpdateBranchInput = {
  name?: string;
  timezone?: string;
  isActive?: boolean;
};

export interface BranchRepository {
  findAll(filter?: { ids?: string[] }): Promise<BranchRecord[]>;
  findById(id: string): Promise<BranchRecord | null>;
  create(input: NewBranchInput): Promise<BranchRecord>;
  update(id: string, input: UpdateBranchInput): Promise<BranchRecord>;
}

export type SubjectRecord = { id: string; name: string; code: string };
export type NewSubjectInput = { name: string; code: string };

export interface SubjectRepository {
  findAll(): Promise<SubjectRecord[]>;
  findByCode(code: string): Promise<SubjectRecord | null>;
  create(input: NewSubjectInput): Promise<SubjectRecord>;
}

export type GradeLevelRecord = { id: string; name: string; sortOrder: number };
export type NewGradeLevelInput = { name: string; sortOrder: number };

export interface GradeLevelRepository {
  findAll(): Promise<GradeLevelRecord[]>;
  findByName(name: string): Promise<GradeLevelRecord | null>;
  create(input: NewGradeLevelInput): Promise<GradeLevelRecord>;
}

export type CourseRecord = {
  id: string;
  subjectId: string;
  gradeLevelId: string;
  name: string;
};
export type NewCourseInput = { subjectId: string; gradeLevelId: string; name: string };
export type UpdateCourseInput = { name?: string };

export interface CourseRepository {
  findAll(): Promise<CourseRecord[]>;
  findById(id: string): Promise<CourseRecord | null>;
  findBySubjectAndGrade(subjectId: string, gradeLevelId: string): Promise<CourseRecord | null>;
  create(input: NewCourseInput): Promise<CourseRecord>;
  update(id: string, input: UpdateCourseInput): Promise<CourseRecord>;
  delete(id: string): Promise<void>;
}

export type BatchRecord = {
  id: string;
  courseId: string;
  branchId: string;
  teacherUserId: string | null;
  room: string;
  capacity: number;
  term: string;
  status: BatchStatus;
};

export type NewBatchInput = {
  courseId: string;
  branchId: string;
  teacherUserId?: string | null;
  room: string;
  capacity: number;
  term: string;
};

export type UpdateBatchInput = {
  teacherUserId?: string | null;
  room?: string;
  capacity?: number;
  status?: BatchStatus;
};

// Omitting branchIds means no branch restriction (Super Admin scope).
export type BatchListFilter = {
  branchIds?: string[];
  teacherUserId?: string;
  courseId?: string;
  status?: BatchStatus;
  term?: string;
};

export interface BatchRepository {
  findAll(filter: BatchListFilter): Promise<BatchRecord[]>;
  findById(id: string): Promise<BatchRecord | null>;
  create(input: NewBatchInput): Promise<BatchRecord>;
  update(id: string, input: UpdateBatchInput): Promise<BatchRecord>;
}

export type ClassScheduleRecord = {
  id: string;
  batchId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type NewClassScheduleInput = {
  batchId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

// A same-branch schedule sharing the day, enriched with its batch's room/teacher for the
// double-booking check (academic-structure capability).
export type ScheduleConflictCandidate = ClassScheduleRecord & {
  room: string;
  teacherUserId: string | null;
};

export interface ClassScheduleRepository {
  findByBatch(batchId: string): Promise<ClassScheduleRecord[]>;
  findById(id: string): Promise<ClassScheduleRecord | null>;
  findConflictCandidates(
    branchId: string,
    dayOfWeek: number,
  ): Promise<ScheduleConflictCandidate[]>;
  create(input: NewClassScheduleInput): Promise<ClassScheduleRecord>;
  delete(id: string): Promise<void>;
}

export type StudentProfileRecord = { id: string; userId: string };

export interface StudentProfileRepository {
  findById(id: string): Promise<StudentProfileRecord | null>;
  findByUserId(userId: string): Promise<StudentProfileRecord | null>;
  create(input: { userId: string }): Promise<StudentProfileRecord>;
}

export interface ParentStudentRepository {
  listStudentProfileIdsForParent(parentUserId: string): Promise<string[]>;
}

export type EnrollmentRecord = {
  id: string;
  batchId: string;
  studentProfileId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
};

// Omitting branchIds/studentProfileIds means no restriction on that dimension (Super Admin scope).
export type EnrollmentListFilter = {
  branchIds?: string[];
  studentProfileIds?: string[];
  batchId?: string;
  status?: EnrollmentStatus;
};

export type NewEnrollmentInput = {
  batchId: string;
  studentProfileId: string;
  capacity: number;
};

// The capacity check and the insert must happen atomically (enrollment capability) — this is a
// single repository operation rather than a separate "check" then "create" at the service layer,
// so the Prisma implementation can wrap both in one serializable transaction.
export type EnrollmentCreateResult =
  | { outcome: 'CREATED'; enrollment: EnrollmentRecord }
  | { outcome: 'AT_CAPACITY' }
  | { outcome: 'DUPLICATE' };

export interface EnrollmentRepository {
  findAll(filter: EnrollmentListFilter): Promise<EnrollmentRecord[]>;
  findById(id: string): Promise<EnrollmentRecord | null>;
  createIfCapacityAvailable(input: NewEnrollmentInput): Promise<EnrollmentCreateResult>;
  updateStatus(id: string, status: EnrollmentStatus): Promise<EnrollmentRecord>;
}

