// Re-export from server
export {
  AuthMode,
  createAuth,
  fetchMicrosoftGroupIds,
  getBaseOptions,
  getSession,
  getSessionWithRole,
  resolveRoleFromGroupIds,
  requireSession,
  syncUserRoleFromMicrosoftGraph,
  type AuthOptions,
  type AuthInstance,
  type MicrosoftRoleGroupConfig,
  type MicrosoftSSOConfig,
} from './server';

// Re-export from policy
export {
  Role,
  type User,
  CurrentUserRef,
  getCurrentUser,
  getMaybeCurrentUser,
  withCurrentUser,
  Policy,
  type PolicyService,
  DatabasePolicyLive,
  requireOwnership,
  requireRole,
} from './policy';

// Re-export errors
export { UnauthorizedError, ForbiddenError, PolicyError } from './errors';
