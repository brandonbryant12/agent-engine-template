import { Command } from '@effect/cli';
import { seedVoicePreviews } from './seed-voice-previews';

export const seed = Command.make('seed', {}).pipe(
  Command.withDescription('Seed data (voice previews, etc.)'),
  Command.withSubcommands([seedVoicePreviews]),
);
