import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..', '..', '..', '..');
const serverEntrypointPath = path.join(repoRoot, 'apps/server/src/server.ts');
const workerEntrypointPath = path.join(repoRoot, 'apps/worker/src/worker.ts');

const assertTelemetryLifecycleContract = (filePath: string) => {
  const source = fs.readFileSync(filePath, 'utf-8');
  const fileLabel = path.relative(repoRoot, filePath);

  if (!source.includes('initTelemetry(')) {
    throw new Error(`${fileLabel} must initialize telemetry via initTelemetry(...)`);
  }

  if (!source.includes('await shutdownTelemetry();')) {
    throw new Error(
      `${fileLabel} must shut down telemetry via await shutdownTelemetry()`,
    );
  }

  if (!source.includes("process.on('SIGINT', shutdown);")) {
    throw new Error(`${fileLabel} must register SIGINT graceful shutdown handler`);
  }

  if (!source.includes("process.on('SIGTERM', shutdown);")) {
    throw new Error(`${fileLabel} must register SIGTERM graceful shutdown handler`);
  }

  if (!source.includes('let shutdownFailed = false;')) {
    throw new Error(
      `${fileLabel} must track shutdown failure state for exit-code mapping`,
    );
  }

  if (!source.includes('process.exit(shutdownFailed ? 1 : 0);')) {
    throw new Error(
      `${fileLabel} must exit non-zero when graceful shutdown cleanup fails`,
    );
  }
};

describe('telemetry lifecycle invariants', () => {
  it('keeps server lifecycle telemetry and signal-shutdown contract', () => {
    assertTelemetryLifecycleContract(serverEntrypointPath);
  });

  it('keeps worker lifecycle telemetry and signal-shutdown contract', () => {
    assertTelemetryLifecycleContract(workerEntrypointPath);
  });
});
