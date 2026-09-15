/* Thin fetch wrapper + session-scoped auth state for the static SPA.
   Needs frontend/js/config.js (API_BASE_URL) loaded first.

   Token lives in sessionStorage rather than a JS variable: this is a set of separate .html
   files (no client-side router), so an in-memory-only token would be lost on every navigation
   between pages. sessionStorage is cleared when the tab closes and isn't shared across tabs. */

const TCMS_TOKEN_KEY = "tcms_access_token";
const TCMS_USER_KEY = "tcms_user";

const TCMS_ROLE_HOME = {
  SUPER_ADMIN: "admin-dashboard.html",
  CENTER_ADMIN: "center-admin-dashboard.html",
  ACCOUNTANT: "accountant-dashboard.html",
  TEACHER: "teacher-dashboard.html",
  STUDENT: "student-home.html",
  PARENT: "parent-home.html",
};

class TcmsApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function tcmsGetToken() {
  return sessionStorage.getItem(TCMS_TOKEN_KEY);
}

function tcmsGetUser() {
  const raw = sessionStorage.getItem(TCMS_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function tcmsSetSession(accessToken, user) {
  sessionStorage.setItem(TCMS_TOKEN_KEY, accessToken);
  sessionStorage.setItem(TCMS_USER_KEY, JSON.stringify(user));
}

function tcmsClearSession() {
  sessionStorage.removeItem(TCMS_TOKEN_KEY);
  sessionStorage.removeItem(TCMS_USER_KEY);
}

// Every route returns { data } on success or { error: { code, message } } on failure
// (backend/src/lib/errorEnvelope.ts) — unwrap that here so callers just get plain values.
async function tcmsApiFetch(path, options = {}) {
  const token = tcmsGetToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${window.TCMS_CONFIG.API_BASE_URL}${path}`, { ...options, headers });
  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const message = body?.error?.message || `Request failed (${res.status})`;
    throw new TcmsApiError(message, body?.error?.code, res.status);
  }

  return body?.data;
}

async function tcmsLogin(email, password) {
  const result = await tcmsApiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  tcmsSetSession(result.accessToken, result.user);
  return result.user;
}

// Downloads a file response (e.g. a CSV report) — fetch() + Authorization header is needed since
// a plain <a href> navigation can't attach the bearer token.
async function tcmsDownloadFile(path, filename) {
  const token = tcmsGetToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${window.TCMS_CONFIG.API_BASE_URL}${path}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new TcmsApiError(
      body?.error?.message || `Request failed (${res.status})`,
      body?.error?.code,
      res.status,
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function tcmsLogout() {
  tcmsClearSession();
  window.location.href = "login.html";
}

function tcmsHomeForRole(role) {
  return TCMS_ROLE_HOME[role] || "login.html";
}

const TCMS_ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  CENTER_ADMIN: "Center Admin",
  ACCOUNTANT: "Accountant",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

function tcmsRoleLabel(role) {
  return TCMS_ROLE_LABELS[role] || role;
}

// Call at the top of every protected page's script. Redirects to login if not signed in.
function tcmsRequireAuth() {
  const user = tcmsGetUser();
  if (!user || !tcmsGetToken()) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}
