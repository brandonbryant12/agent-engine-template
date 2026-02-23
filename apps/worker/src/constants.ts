export const WORKER_DEFAULTS = {
  POLL_INTERVAL_MS: 5000,
  MAX_CONSECUTIVE_ERRORS: 10,
  BACKOFF_CAP_MS: 60_000,
} as const;

export const QUEUE_DEFAULTS = {
  POLL_INTERVAL_MS: 3000,
} as const;

/** Maximum number of jobs processed concurrently */
export const MAX_CONCURRENT_JOBS = 5;

/** Jobs stuck in `processing` longer than this are considered orphaned */
export const STALE_JOB_MAX_AGE_MS = 60 * 60 * 1000; // 60 minutes

/** Run the stale-job reaper every N poll cycles (~3 min at 3s polling) */
export const STALE_CHECK_EVERY_N_POLLS = 60;
