import { type BetterAuthOptions, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { openAPI } from 'better-auth/plugins';
import urlJoin from 'url-join';
import type { DatabaseInstance } from '@repo/db/client';
import {
  type MicrosoftRoleGroupConfig,
  syncUserRoleFromMicrosoftGraph,
} from './microsoft-role-sync';

export const AuthMode = {
  DEV_PASSWORD: 'dev-password',
  HYBRID: 'hybrid',
  SSO_ONLY: 'sso-only',
} as const;
export type AuthMode = (typeof AuthMode)[keyof typeof AuthMode];

export interface MicrosoftSSOConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  roleGroups: MicrosoftRoleGroupConfig;
}

export interface AuthOptions {
  webUrl: string;
  serverUrl: string;
  apiPath: `/${string}`;
  authSecret: string;
  authMode: AuthMode;
  db: DatabaseInstance;
  microsoftSSO?: MicrosoftSSOConfig;
}

export type AuthInstance = ReturnType<typeof createAuth>;

const isPasswordAuthEnabled = (authMode: AuthMode) =>
  authMode !== AuthMode.SSO_ONLY;

const isMicrosoftSSOEnabled = (authMode: AuthMode) =>
  authMode !== AuthMode.DEV_PASSWORD;

const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'GroupMember.Read.All',
];

/**
 * This function is abstracted for schema generations in cli-config.ts
 */
export const getBaseOptions = (db: DatabaseInstance) =>
  ({
    database: drizzleAdapter(db, { provider: 'pg' }),
    plugins: [openAPI()],
  }) satisfies BetterAuthOptions;

export const createAuth = ({
  webUrl,
  serverUrl,
  apiPath,
  db,
  authSecret,
  authMode,
  microsoftSSO,
}: AuthOptions) =>
  betterAuth({
    ...getBaseOptions(db),
    baseURL: urlJoin(serverUrl, apiPath, 'auth'),
    secret: authSecret,
    trustedOrigins: [new URL(webUrl).origin],
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'user',
          input: false,
        },
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    socialProviders:
      isMicrosoftSSOEnabled(authMode) && microsoftSSO
        ? {
            microsoft: {
              clientId: microsoftSSO.clientId,
              clientSecret: microsoftSSO.clientSecret,
              tenantId: microsoftSSO.tenantId,
              scope: MICROSOFT_SCOPES,
            },
          }
        : undefined,
    databaseHooks:
      isMicrosoftSSOEnabled(authMode) && microsoftSSO
        ? {
            session: {
              create: {
                after: async (session) => {
                  try {
                    await syncUserRoleFromMicrosoftGraph({
                      db,
                      userId: session.userId,
                      roleGroups: microsoftSSO.roleGroups,
                    });
                  } catch (error) {
                    console.warn(
                      '[AUTH] Failed to sync role from Microsoft Graph:',
                      error instanceof Error ? error.message : String(error),
                    );
                  }
                },
              },
            },
          }
        : undefined,
    emailAndPassword: {
      enabled: isPasswordAuthEnabled(authMode),
      autoSignIn: true,
      requireEmailVerification: false,
    },
  });
