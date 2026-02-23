import { Args, Command } from '@effect/cli';
import { eq } from '@repo/db';
import { createDb } from '@repo/db/client';
import { user } from '@repo/db/schema';
import { Console, Effect } from 'effect';
import { loadEnv, type EnvError } from '../lib/env';

const emailArg = Args.text({ name: 'email' }).pipe(
  Args.withDescription('Email address of the user to promote'),
);

const run = (email: string) =>
  Effect.gen(function* () {
    const env = yield* loadEnv();

    if (!env.SERVER_POSTGRES_URL) {
      yield* Console.log('Error: SERVER_POSTGRES_URL is required.');
      return;
    }

    const db = createDb({ databaseUrl: env.SERVER_POSTGRES_URL });

    try {
      const [updated] = yield* Effect.promise(() =>
        db
          .update(user)
          .set({ role: 'admin' })
          .where(eq(user.email, email))
          .returning({ email: user.email, role: user.role }),
      );

      if (!updated) {
        yield* Console.log(`No user found with email: ${email}`);
        return;
      }

      yield* Console.log(`Done: ${updated.email} → role=${updated.role}`);
    } finally {
      yield* Effect.promise(() => db.$client.end());
    }
  }).pipe(
    Effect.catchTag('EnvError', (e: EnvError) =>
      Console.log(`\nEnvironment error: ${e.message}`),
    ),
  );

const setRole = Command.make('set-role', { email: emailArg }, ({ email }) =>
  run(email),
).pipe(Command.withDescription('Promote a user to admin role by email'));

export const admin = Command.make('admin', {}).pipe(
  Command.withDescription('User administration commands'),
  Command.withSubcommands([setRole]),
);
