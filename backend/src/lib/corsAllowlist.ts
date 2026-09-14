// Exact-match allow-list check for CORS Origin headers (never wildcard/substring match — see R-14).
export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (origin === undefined) {
    // No Origin header means a non-browser caller (curl, server-to-server health check), not a
    // cross-site browser request that CORS is meant to police.
    return true;
  }

  return allowedOrigins.includes(origin);
}
