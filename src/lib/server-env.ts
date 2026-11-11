import "server-only";

/**
 * Server-only secrets. Importing this file from a client component fails the
 * build, so these values can never reach the browser.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing server environment variable ${name}.`);
  }
  return value;
}

/** Passed as the first argument to every portal_* database function. */
export function portalServerSecret(): string {
  return required("PORTAL_SERVER_SECRET");
}

/** Checked by the daily cleanup cron route. */
export function cronSecret(): string {
  return required("CRON_SECRET");
}

/** Salt for hashing IP addresses before they are stored for rate limiting. */
export function ipHashSalt(): string {
  return required("IP_HASH_SALT");
}
