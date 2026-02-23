export * from './user';

import { resetUserCounter } from './user';

/**
 * Reset all factory counters.
 * Call this in beforeEach for consistent test IDs.
 */
export function resetAllFactories() {
  resetUserCounter();
}
