// Auth configuration
export {
  AuthMode,
  createAuth,
  getBaseOptions,
  type AuthOptions,
  type AuthInstance,
  type MicrosoftSSOConfig,
} from './auth';

export {
  fetchMicrosoftGroupIds,
  resolveRoleFromGroupIds,
  syncUserRoleFromMicrosoftGraph,
  type MicrosoftRoleGroupConfig,
} from './microsoft-role-sync';

// Effect-based session wrappers
export { getSession, getSessionWithRole, requireSession } from './session';
