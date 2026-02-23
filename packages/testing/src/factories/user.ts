import { randomUUID } from 'crypto';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

export interface CreateTestUserOptions {
  id?: string;
  email?: string;
  name?: string;
  role?: 'user' | 'admin';
}

let userCounter = 0;

export function createTestUser(options: CreateTestUserOptions = {}): TestUser {
  userCounter++;
  const id = options.id ?? randomUUID();
  return {
    id,
    email: options.email ?? `testuser-${id}@example.com`,
    name: options.name ?? `Test User ${userCounter}`,
    role: options.role ?? 'user',
  };
}

export function createTestAdmin(
  options: Omit<CreateTestUserOptions, 'role'> = {},
): TestUser {
  return createTestUser({ ...options, role: 'admin' });
}

export function resetUserCounter() {
  userCounter = 0;
}
