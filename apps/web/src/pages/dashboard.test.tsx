import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DashboardPage } from './dashboard';

const { listRunsMock } = vi.hoisted(() => ({
  listRunsMock: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: ReactNode;
    to: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/clients/api-client', () => ({
  rawApiClient: {
    runs: {
      list: listRunsMock,
    },
  },
}));

vi.mock('@/clients/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: 'user-1' } } }),
  },
}));

vi.mock('@/lib/chat-utils', () => ({
  loadThreads: () => [],
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    listRunsMock.mockReset();
  });

  it('shows an explicit runs load failure and recovers on retry', async () => {
    listRunsMock
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce([
        {
          id: 'run-1',
          status: 'pending',
          prompt: 'First run',
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

    expect(await screen.findByText('Runs failed to load.')).toBeInTheDocument();
    expect(screen.getByText('Unable to load recent runs.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry loading runs' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry loading runs' }));

    await waitFor(() => {
      expect(listRunsMock).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('First run')).toBeInTheDocument();
    expect(screen.queryByText('Runs failed to load.')).not.toBeInTheDocument();
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
  });
});
