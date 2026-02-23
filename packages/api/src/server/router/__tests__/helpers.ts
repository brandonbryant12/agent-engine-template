import { ORPCError } from '@orpc/client';
import { ManagedRuntime, type Layer } from 'effect';
import type { User } from '@repo/auth/policy';
import type { AuthenticatedORPCContext, ORPCContext } from '../../orpc';
import type { ServerRuntime } from '../../runtime';

interface TestSession {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export const createMockSession = (user: User): TestSession => ({
  session: {
    id: `session_${user.id}`,
    userId: user.id,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    token: `token_${user.id}`,
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  },
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

export function createMockContext(
  runtime: ServerRuntime,
  user: User,
): AuthenticatedORPCContext;
export function createMockContext(
  runtime: ServerRuntime,
  user: null,
): ORPCContext;
export function createMockContext(
  runtime: ServerRuntime,
  user: User | null,
): ORPCContext | AuthenticatedORPCContext {
  if (user === null) {
    return {
      session: null,
      user: null,
      requestId: 'test-request-id',
      runtime,
    };
  }

  return {
    session: createMockSession(user),
    user,
    requestId: 'test-request-id',
    runtime,
  } as AuthenticatedORPCContext;
}

export type ErrorCode =
  | 'INPUT_VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'RATE_LIMITED';

export interface MockErrorFactory {
  INPUT_VALIDATION_FAILED: (opts: {
    message: string;
    data?: unknown;
  }) => ORPCError<string, unknown>;
  UNAUTHORIZED: (opts: {
    message: string;
    data?: unknown;
  }) => ORPCError<string, unknown>;
  FORBIDDEN: (opts: {
    message: string;
    data?: unknown;
  }) => ORPCError<string, unknown>;
  NOT_FOUND: (opts: {
    message: string;
    data?: unknown;
  }) => ORPCError<string, unknown>;
  INTERNAL_ERROR: (opts: {
    message: string;
    data?: unknown;
  }) => ORPCError<string, unknown>;
  SERVICE_UNAVAILABLE: (opts: {
    message: string;
    data?: unknown;
  }) => ORPCError<string, unknown>;
  RATE_LIMITED: (opts: {
    message: string;
    data?: unknown;
  }) => ORPCError<string, unknown>;
}

const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  INPUT_VALIDATION_FAILED: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 502,
  RATE_LIMITED: 429,
};

export const createMockErrors = (): MockErrorFactory => {
  const createErrorFactory =
    (code: ErrorCode) =>
    (opts: { message: string; data?: unknown }): ORPCError<string, unknown> =>
      new ORPCError(code, {
        status: ERROR_STATUS_CODES[code],
        message: opts.message,
        data: opts.data,
      });

  return {
    INPUT_VALIDATION_FAILED: createErrorFactory('INPUT_VALIDATION_FAILED'),
    UNAUTHORIZED: createErrorFactory('UNAUTHORIZED'),
    FORBIDDEN: createErrorFactory('FORBIDDEN'),
    NOT_FOUND: createErrorFactory('NOT_FOUND'),
    INTERNAL_ERROR: createErrorFactory('INTERNAL_ERROR'),
    SERVICE_UNAVAILABLE: createErrorFactory('SERVICE_UNAVAILABLE'),
    RATE_LIMITED: createErrorFactory('RATE_LIMITED'),
  };
};

export const assertORPCError = (
  error: unknown,
  expectedCode: ErrorCode,
): asserts error is ORPCError<string, unknown> => {
  if (!(error instanceof ORPCError)) {
    throw new Error(`Expected ORPCError but got ${typeof error}: ${error}`);
  }
  if (error.code !== expectedCode) {
    throw new Error(
      `Expected error code '${expectedCode}' but got '${error.code}'`,
    );
  }
};

export const createTestServerRuntime = <R>(
  layers: Layer.Layer<R>,
): ServerRuntime => ManagedRuntime.make(layers) as unknown as ServerRuntime;

export { ORPCError };
