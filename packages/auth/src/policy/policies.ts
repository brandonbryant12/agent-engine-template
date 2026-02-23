import { Effect } from 'effect';
import { ForbiddenError } from '../errors';
import { Role } from './types';
import { getCurrentUser } from './user';

/** Require current user owns the resource */
export const requireOwnership = (resourceOwnerId: string) =>
  getCurrentUser.pipe(
    Effect.filterOrFail(
      (user) => user.id === resourceOwnerId || user.role === Role.ADMIN,
      () => new ForbiddenError({ message: 'You do not own this resource' }),
    ),
    Effect.withSpan('policy.requireOwnership'),
  );

/** Require user has specific role */
export const requireRole = (requiredRole: Role) =>
  getCurrentUser.pipe(
    Effect.filterOrFail(
      (user) => user.role === requiredRole || user.role === Role.ADMIN,
      () => new ForbiddenError({ message: `Requires ${requiredRole} role` }),
    ),
    Effect.withSpan('policy.requireRole', {
      attributes: { 'policy.role': requiredRole },
    }),
  );
