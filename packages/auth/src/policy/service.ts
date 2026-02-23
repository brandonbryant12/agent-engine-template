import { Context } from 'effect';
import type { PolicyError } from '../errors';
import type { Role } from './types';
import type { Effect } from 'effect';

export interface PolicyService {
  /** Get user's role from database */
  readonly getUserRole: (userId: string) => Effect.Effect<Role, PolicyError>;
}

export class Policy extends Context.Tag('@repo/auth-policy/Policy')<
  Policy,
  PolicyService
>() {}
