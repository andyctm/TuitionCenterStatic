export type AppErrorDetail = { field: string; issue: string };

// Thrown by services/routes; caught by the central error-handling middleware (see errorEnvelope.ts).
export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: AppErrorDetail[];

  constructor(code: string, httpStatus: number, message: string, details?: AppErrorDetail[]) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}
