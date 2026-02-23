import { and, desc, eq } from '@repo/db';
import { account, user } from '@repo/db/schema';
import type { DatabaseInstance } from '@repo/db/client';
import { Role } from '../policy/types';

export interface MicrosoftRoleGroupConfig {
  readonly adminGroupIds: readonly string[];
  readonly userGroupIds: readonly string[];
}

interface GraphMemberOfResponse {
  readonly value?: Array<{ readonly id?: string }>;
  readonly '@odata.nextLink'?: string;
}

const GRAPH_GROUPS_URL =
  'https://graph.microsoft.com/v1.0/me/transitiveMemberOf/microsoft.graph.group?$select=id';

const asRole = (role: string | null | undefined) =>
  role === Role.ADMIN ? Role.ADMIN : Role.USER;

export const resolveRoleFromGroupIds = ({
  groupIds,
  roleGroups,
}: {
  groupIds: ReadonlySet<string>;
  roleGroups: MicrosoftRoleGroupConfig;
}) => {
  if (roleGroups.adminGroupIds.some((groupId) => groupIds.has(groupId))) {
    return Role.ADMIN;
  }

  if (roleGroups.userGroupIds.some((groupId) => groupIds.has(groupId))) {
    return Role.USER;
  }

  return Role.USER;
};

export const fetchMicrosoftGroupIds = async ({
  accessToken,
  fetchFn = fetch,
}: {
  accessToken: string;
  fetchFn?: typeof fetch;
}): Promise<Set<string>> => {
  const groupIds = new Set<string>();
  let nextUrl: string | null = GRAPH_GROUPS_URL;

  while (nextUrl) {
    const response = await fetchFn(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Microsoft Graph groups request failed: ${response.status} ${response.statusText} (${errorBody.slice(0, 500)})`,
      );
    }

    const payload = (await response.json()) as GraphMemberOfResponse;
    for (const item of payload.value ?? []) {
      if (typeof item?.id === 'string' && item.id.length > 0) {
        groupIds.add(item.id);
      }
    }

    nextUrl =
      typeof payload['@odata.nextLink'] === 'string'
        ? payload['@odata.nextLink']
        : null;
  }

  return groupIds;
};

const getLatestMicrosoftAccessToken = async ({
  db,
  userId,
}: {
  db: DatabaseInstance;
  userId: string;
}): Promise<string | null> => {
  const [row] = await db
    .select({ accessToken: account.accessToken })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'microsoft')))
    .orderBy(desc(account.updatedAt))
    .limit(1);

  return row?.accessToken ?? null;
};

export const syncUserRoleFromMicrosoftGraph = async ({
  db,
  userId,
  roleGroups,
  fetchFn = fetch,
}: {
  db: DatabaseInstance;
  userId: string;
  roleGroups: MicrosoftRoleGroupConfig;
  fetchFn?: typeof fetch;
}): Promise<void> => {
  const accessToken = await getLatestMicrosoftAccessToken({ db, userId });
  if (!accessToken) return;

  const graphGroupIds = await fetchMicrosoftGroupIds({
    accessToken,
    fetchFn,
  });
  const resolvedRole = resolveRoleFromGroupIds({
    groupIds: graphGroupIds,
    roleGroups,
  });

  const [currentUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (asRole(currentUser?.role) === resolvedRole) return;

  await db.update(user).set({ role: resolvedRole }).where(eq(user.id, userId));
};
