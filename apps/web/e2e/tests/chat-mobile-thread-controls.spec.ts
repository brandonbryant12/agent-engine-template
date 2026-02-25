import { expect, test } from '@playwright/test';

test('mobile users can create and switch chat threads', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const runId = Date.now();
  const email = `mobile-thread-${runId}@example.com`;
  const password = 'StrongPassword123!';

  await page.getByRole('button', { name: 'Need an account? Create one' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  await page.goto('/chat');

  const storagePrefix = 'agent-engine-template.chat.threads.';
  const seededThreads = [
    {
      id: 'thread_alpha',
      title: 'Incident alpha',
      createdAt: '2026-02-25T00:00:00.000Z',
      updatedAt: '2026-02-25T00:00:00.000Z',
      messages: [],
    },
    {
      id: 'thread_beta',
      title: 'Incident beta',
      createdAt: '2026-02-25T00:00:00.000Z',
      updatedAt: '2026-02-25T00:00:00.000Z',
      messages: [],
    },
  ];

  await page.waitForFunction(
    (prefix) =>
      Object.keys(window.localStorage).some((key) => key.startsWith(prefix)),
    storagePrefix,
  );

  await page.evaluate(
    ({ prefix, threads }) => {
      const key = Object.keys(window.localStorage).find((entry) =>
        entry.startsWith(prefix),
      );

      if (!key) {
        throw new Error('Thread storage key not found');
      }

      window.localStorage.setItem(key, JSON.stringify(threads));
    },
    { prefix: storagePrefix, threads: seededThreads },
  );

  await page.reload();

  const threadMenuButton = page.getByRole('button', { name: 'Open thread menu' });
  const activeThreadLabels = page.getByLabel('Current active thread');

  await expect(threadMenuButton).toContainText('Threads (2)');
  await expect(activeThreadLabels.first()).toContainText('Incident alpha');

  await threadMenuButton.click();
  await page.getByRole('menuitem', { name: 'Incident beta' }).click();
  await expect(activeThreadLabels.first()).toContainText('Incident beta');

  await threadMenuButton.click();
  await page.getByRole('menuitem', { name: '+ New thread' }).click();
  await expect(threadMenuButton).toContainText('Threads (3)');
  await expect(activeThreadLabels.first()).toContainText('New chat');

  await threadMenuButton.click();
  await page.getByRole('menuitem', { name: 'Incident alpha' }).click();
  await expect(activeThreadLabels.first()).toContainText('Incident alpha');
});
