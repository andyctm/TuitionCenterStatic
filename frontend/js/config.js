// Static SPA config — no build step, so this is the one place the API's base URL is set.
// Local dev points at the Express server started via `npm run dev` in backend/ (see
// backend/.env.example PORT). Production deploys should replace this file's value with the
// Render service URL as part of the GitHub Pages deploy step (see docs/08-implementation-plan.md M0).
window.TCMS_CONFIG = {
  API_BASE_URL: 'http://localhost:4000/api',
};
