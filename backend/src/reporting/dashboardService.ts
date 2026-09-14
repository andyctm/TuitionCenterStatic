import type { AttendanceStatus } from '@prisma/client';
import { calculateAttendancePercentage } from '../attendance/attendancePercentage';
import { isSuperAdmin } from '../lib/branchScope';
import type { AuthContext } from '../types/authContext';
import type {
  AttendanceRepository,
  BatchRepository,
  ClassSessionRepository,
  CourseRepository,
  EnrollmentRepository,
  ParentStudentRepository,
  StudentProfileRepository,
} from '../repositories/types';

export type DashboardServiceDeps = {
  batchRepo: BatchRepository;
  courseRepo: CourseRepository;
  enrollmentRepo: EnrollmentRepository;
  classSessionRepo: ClassSessionRepository;
  attendanceRepo: AttendanceRepository;
  studentProfileRepo: StudentProfileRepository;
  parentStudentRepo: ParentStudentRepository;
};

export type AdminDashboardSummary = {
  role: 'ADMIN';
  activeStudentsCount: number;
  activeBatchesCount: number;
  batchesAtCapacityCount: number;
};

export type TodaysSessionSummary = {
  sessionId: string;
  batchId: string;
  courseName: string;
  room: string;
  sessionDate: Date;
  attendanceMarked: boolean;
};

export type TeacherDashboardSummary = {
  role: 'TEACHER';
  todaysSessions: TodaysSessionSummary[];
  pendingAttendanceCount: number;
};

export type NextClassSummary = {
  batchId: string;
  courseName: string;
  room: string;
  sessionDate: Date;
};

export type StudentAttendanceEntry = {
  sessionDate: Date;
  status: AttendanceStatus;
  remarks: string | null;
};

export type StudentDashboardSummary = {
  role: 'STUDENT';
  nextClass: NextClassSummary | null;
  recentAttendance: StudentAttendanceEntry[];
  attendancePercentage: number;
};

export type ParentChildSummary = {
  studentProfileId: string;
  nextClass: NextClassSummary | null;
  recentAttendance: StudentAttendanceEntry[];
  attendancePercentage: number;
};

export type ParentDashboardSummary = {
  role: 'PARENT';
  children: ParentChildSummary[];
};

export type DashboardSummary =
  | AdminDashboardSummary
  | TeacherDashboardSummary
  | StudentDashboardSummary
  | ParentDashboardSummary;

const RECENT_ATTENDANCE_LIMIT = 5;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function createDashboardService(deps: DashboardServiceDeps) {
  const {
    batchRepo,
    courseRepo,
    enrollmentRepo,
    classSessionRepo,
    attendanceRepo,
    studentProfileRepo,
    parentStudentRepo,
  } = deps;

  async function getAdminSummary(ctx: AuthContext): Promise<AdminDashboardSummary> {
    const branchIds = isSuperAdmin(ctx) ? undefined : ctx.branchIds;
    const [batches, activeEnrollments] = await Promise.all([
      batchRepo.findAll({ branchIds, status: 'ACTIVE' }),
      enrollmentRepo.findAll({ branchIds, status: 'ACTIVE' }),
    ]);

    const activeStudentIds = new Set(activeEnrollments.map((e) => e.studentProfileId));
    const enrollmentCountByBatch = new Map<string, number>();
    for (const enrollment of activeEnrollments) {
      enrollmentCountByBatch.set(
        enrollment.batchId,
        (enrollmentCountByBatch.get(enrollment.batchId) ?? 0) + 1,
      );
    }
    const batchesAtCapacityCount = batches.filter(
      (b) => (enrollmentCountByBatch.get(b.id) ?? 0) >= b.capacity,
    ).length;

    return {
      role: 'ADMIN',
      activeStudentsCount: activeStudentIds.size,
      activeBatchesCount: batches.length,
      batchesAtCapacityCount,
    };
  }

  async function getTeacherSummary(ctx: AuthContext, now: Date): Promise<TeacherDashboardSummary> {
    const today = startOfUtcDay(now);
    const teacherBatches = await batchRepo.findAll({ teacherUserId: ctx.userId, status: 'ACTIVE' });

    const todaysSessions: TodaysSessionSummary[] = [];
    let pendingAttendanceCount = 0;

    for (const batch of teacherBatches) {
      const [sessions, course] = await Promise.all([
        classSessionRepo.findByBatch(batch.id),
        courseRepo.findById(batch.courseId),
      ]);

      for (const session of sessions) {
        const sessionDay = startOfUtcDay(session.sessionDate);
        if (sessionDay.getTime() === today.getTime()) {
          const attendance = await attendanceRepo.findBySession(session.id);
          todaysSessions.push({
            sessionId: session.id,
            batchId: batch.id,
            courseName: course?.name ?? 'Unknown course',
            room: batch.room,
            sessionDate: session.sessionDate,
            attendanceMarked: attendance.length > 0,
          });
        } else if (sessionDay.getTime() < today.getTime()) {
          const attendance = await attendanceRepo.findBySession(session.id);
          if (attendance.length === 0) pendingAttendanceCount += 1;
        }
      }
    }

    todaysSessions.sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());

    return { role: 'TEACHER', todaysSessions, pendingAttendanceCount };
  }

  async function buildStudentSummary(
    studentProfileId: string,
    now: Date,
  ): Promise<{
    nextClass: NextClassSummary | null;
    recentAttendance: StudentAttendanceEntry[];
    attendancePercentage: number;
  }> {
    const today = startOfUtcDay(now);
    const activeEnrollments = await enrollmentRepo.findAll({
      studentProfileIds: [studentProfileId],
      status: 'ACTIVE',
    });

    let nextClass: NextClassSummary | null = null;
    for (const enrollment of activeEnrollments) {
      const batch = await batchRepo.findById(enrollment.batchId);
      if (!batch) continue;
      const sessions = await classSessionRepo.findByBatch(batch.id);
      const upcoming = sessions
        .filter((s) => s.status === 'SCHEDULED' && s.sessionDate.getTime() >= today.getTime())
        .sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime())[0];
      if (!upcoming) continue;
      if (!nextClass || upcoming.sessionDate.getTime() < nextClass.sessionDate.getTime()) {
        const course = await courseRepo.findById(batch.courseId);
        nextClass = {
          batchId: batch.id,
          courseName: course?.name ?? 'Unknown course',
          room: batch.room,
          sessionDate: upcoming.sessionDate,
        };
      }
    }

    const records = await attendanceRepo.findByStudent(studentProfileId);
    const recentAttendance = [...records]
      .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime())
      .slice(0, RECENT_ATTENDANCE_LIMIT)
      .map((r) => ({ sessionDate: r.sessionDate, status: r.status, remarks: r.remarks }));

    return {
      nextClass,
      recentAttendance,
      attendancePercentage: calculateAttendancePercentage(records),
    };
  }

  async function getStudentSummary(ctx: AuthContext, now: Date): Promise<StudentDashboardSummary> {
    const profile = await studentProfileRepo.findByUserId(ctx.userId);
    if (!profile) {
      return { role: 'STUDENT', nextClass: null, recentAttendance: [], attendancePercentage: 0 };
    }
    const summary = await buildStudentSummary(profile.id, now);
    return { role: 'STUDENT', ...summary };
  }

  async function getParentSummary(ctx: AuthContext, now: Date): Promise<ParentDashboardSummary> {
    const studentProfileIds = await parentStudentRepo.listStudentProfileIdsForParent(ctx.userId);
    const children = await Promise.all(
      studentProfileIds.map(async (studentProfileId) => ({
        studentProfileId,
        ...(await buildStudentSummary(studentProfileId, now)),
      })),
    );
    return { role: 'PARENT', children };
  }

  return {
    async getSummary(ctx: AuthContext, now: Date = new Date()): Promise<DashboardSummary> {
      switch (ctx.role) {
        case 'SUPER_ADMIN':
        case 'CENTER_ADMIN':
        case 'ACCOUNTANT':
          return getAdminSummary(ctx);
        case 'TEACHER':
          return getTeacherSummary(ctx, now);
        case 'STUDENT':
          return getStudentSummary(ctx, now);
        case 'PARENT':
          return getParentSummary(ctx, now);
      }
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
