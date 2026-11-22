import { httpError } from "./errors.js";

// Simple in‑memory lock / rate‑limit helper for auth attempts.
// Not suitable for a multi‑instance deployment, but works for local dev.

/**
 * Generate a deterministic lock key for a request.
 * Uses the request IP and the identifier (email or phone).
 */
export function lockKey(req, identifier) {
  const ip = req.ip || "unknown";
  return `${ip}:${identifier}`;
}

/**
 * Throw if the given key is currently locked (too many failures).
 */
export function assertNotLocked(key) {
  const entry = failures.get(key);
  if (entry?.locked) {
    throw httpError(429, "LOCKED", "Too many failed attempts. Please wait before retrying.");
  }
}

/**
 * Record a failure for the given key. After a threshold, lock the key.
 */
export function recordFailure(key) {
  const THRESHOLD = 5; // attempts
  const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

  let entry = failures.get(key);
  if (!entry) {
    entry = { count: 0, locked: false };
  }
  entry.count += 1;
  if (entry.count >= THRESHOLD) {
    entry.locked = true;
    // Auto‑unlock after LOCK_TIME_MS
    setTimeout(() => failures.delete(key), LOCK_TIME_MS);
  }
  failures.set(key, entry);
}

/**
 * Map storing failure information per lock key.
 */
export const failures = new Map();
