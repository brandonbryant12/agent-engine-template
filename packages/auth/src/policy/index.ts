// Types
export { Role, type User } from './types';

// Current user context (FiberRef-based)
export {
  CurrentUserRef,
  getCurrentUser,
  getMaybeCurrentUser,
  withCurrentUser,
} from './user';

// Policy service
export { Policy, type PolicyService } from './service';

// Policy provider
export { DatabasePolicyLive } from './provider';

// Policy helper functions
export { requireOwnership, requireRole } from './policies';
