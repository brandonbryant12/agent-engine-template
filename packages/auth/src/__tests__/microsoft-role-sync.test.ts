import { describe, expect, it, vi } from 'vitest';
import { Role } from '../policy/types';
import {
  fetchMicrosoftGroupIds,
  resolveRoleFromGroupIds,
} from '../server/microsoft-role-sync';

const asJsonResponse = (value: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

describe('resolveRoleFromGroupIds', () => {
  it('prefers admin role when user matches both role groups', () => {
    const role = resolveRoleFromGroupIds({
      groupIds: new Set(['admin-group-id', 'user-group-id']),
      roleGroups: {
        adminGroupIds: ['admin-group-id'],
        userGroupIds: ['user-group-id'],
      },
    });

    expect(role).toBe(Role.ADMIN);
  });

  it('assigns user role when user is only in user groups', () => {
    const role = resolveRoleFromGroupIds({
      groupIds: new Set(['user-group-id']),
      roleGroups: {
        adminGroupIds: ['admin-group-id'],
        userGroupIds: ['user-group-id'],
      },
    });

    expect(role).toBe(Role.USER);
  });

  it('falls back to user role when no configured groups match', () => {
    const role = resolveRoleFromGroupIds({
      groupIds: new Set(['some-other-group']),
      roleGroups: {
        adminGroupIds: ['admin-group-id'],
        userGroupIds: ['user-group-id'],
      },
    });

    expect(role).toBe(Role.USER);
  });
});

describe('fetchMicrosoftGroupIds', () => {
  it('loads all pages from Graph and returns a unique id set', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        asJsonResponse({
          value: [{ id: 'group-a' }, { id: 'group-b' }],
          '@odata.nextLink':
            'https://graph.microsoft.com/v1.0/me/transitiveMemberOf?$skiptoken=abc',
        }),
      )
      .mockResolvedValueOnce(
        asJsonResponse({
          value: [{ id: 'group-b' }, { id: 'group-c' }],
        }),
      );

    const groupIds = await fetchMicrosoftGroupIds({
      accessToken: 'access-token',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(groupIds).toEqual(new Set(['group-a', 'group-b', 'group-c']));
  });

  it('throws when Microsoft Graph returns an error response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        asJsonResponse(
          { error: { message: 'Forbidden' } },
          { status: 403, statusText: 'Forbidden' },
        ),
      );

    await expect(
      fetchMicrosoftGroupIds({
        accessToken: 'access-token',
        fetchFn: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow('Microsoft Graph groups request failed');
  });
});
