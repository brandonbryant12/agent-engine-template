import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FilesystemStorageLive } from '@repo/storage';
import type { Storage } from '@repo/storage';
import type { Layer } from 'effect';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../../.output/storage-test');

export const createStorageLayer = (): Layer.Layer<Storage> =>
  FilesystemStorageLive({
    basePath: OUTPUT_DIR,
    baseUrl: `file://${OUTPUT_DIR}`,
  });
