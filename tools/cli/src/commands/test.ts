import { Command } from '@effect/cli';
import { testLlm } from './test-llm';
import { testStorage } from './test-storage';
import { testTts } from './test-tts';

export const test = Command.make('test', {}).pipe(
  Command.withDescription('Test integrations (LLM, TTS, Storage)'),
  Command.withSubcommands([testLlm, testTts, testStorage]),
);
