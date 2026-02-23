import { Command } from '@effect/cli';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { Effect } from 'effect';
import { admin } from './commands/admin';
import { seed } from './commands/seed';
import { test } from './commands/test';
import { configureProxy } from './lib/proxy';

configureProxy();

const cli = Command.make('cli', {}).pipe(
  Command.withDescription('Template App developer CLI'),
  Command.withSubcommands([admin, test, seed]),
);

const app = Command.run(cli, {
  name: 'Template App CLI',
  version: '0.0.1',
});

const args = process.argv;

app(args).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
