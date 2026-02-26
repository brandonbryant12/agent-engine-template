import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DashboardPage } from './dashboard';

const { runsListMock } = vi.hoisted(() => ({
  runsListMock: vi.fn(),
}));

vi.mock('@/clients/api-client', () => ({
  rawApiClient: {
    runs: {
      list: runsListMock,
    },
  },
}));

vi.mock('@/clients/auth-client', () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: { id: 'user_test' },
      },
    }),
  },
}));

vi.mock('@/lib/chat-utils', () => ({
  loadThreads: () => [],
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

afterEach(() => {
  runsListMock.mockReset();
});

describe('DashboardPage', () => {
  it('shows explicit runs-load error state with retry and recovers on successful retry', async () => {
    runsListMock
      .mockRejectedValueOnce(new Error('Runs API unavailable'))
      .mockResolvedValueOnce([
        {
          id: 'run_1',
          status: 'pending',
          prompt: 'Quarterly planning',
          threadId: null,
          result: null,
          error: null,
          createdAt: '2026-02-26T00:00:00.000Z',
          updatedAt: '2026-02-26T00:00:00.000Z',
          startedAt: null,
          completedAt: null,
        },
      ]);

    render(<DashboardPage />);

    await screen.findByText('Runs API unavailable');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Retry runs load' }));

    await waitFor(() => {
      expect(runsListMock).toHaveBeenCalledTimes(2);
    });

    await screen.findByText('Quarterly planning');
    expect(screen.queryByText('Runs API unavailable')).toBeNull();
    expect(screen.getByText(/Last successful update:/)).toBeTruthy();
  });
});
